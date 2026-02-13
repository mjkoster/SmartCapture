/**
 * Background service worker — the extension's main orchestrator.
 *
 * Responsibilities:
 *   - Listen for the keyboard shortcut command
 *   - Route messages between popup, content scripts, and storage
 *   - Initialize the storage backend on startup
 */

import type { IStorageBackend } from '../types/storage';
import type { ExtensionConfig } from '../types/config';
import { DEFAULT_CONFIG } from '../types/config';
import { CaptureEngine } from './capture-engine';
import { getStorageBackend } from '../storage/storage-factory';
import { createLogger } from '../utils/logger';

const log = createLogger('ServiceWorker');

let storage: IStorageBackend;
let engine: CaptureEngine;
let config: ExtensionConfig;

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

async function initialize(): Promise<void> {
  log.info('Initializing Smart Capture');

  // Load config
  const stored = await chrome.storage.sync.get('sc_config');
  config = stored.sc_config ?? DEFAULT_CONFIG;

  // Initialize storage backend
  storage = await getStorageBackend(config.storageBackend);
  engine = new CaptureEngine(storage);

  log.info(`Ready — storage: ${config.storageBackend}`);
}

// Initialize on install and on service worker startup
chrome.runtime.onInstalled.addListener(() => {
  initialize().catch((err) => log.error('Init failed on install', err));
});

// Self-initializing: MV3 service workers can restart at any time
initialize().catch((err) => log.error('Init failed', err));

// ---------------------------------------------------------------------------
// Keyboard shortcut handler
// ---------------------------------------------------------------------------

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'trigger-capture') return;

  log.info('Capture triggered via keyboard shortcut');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) {
    log.warn('No active tab with URL');
    return;
  }

  // Skip chrome:// and extension pages
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    log.warn('Cannot capture chrome:// or extension pages');
    await showBadge('!', '#ef4444', tab.id);
    return;
  }

  try {
    await engine.capture(tab.id);
    await showBadge('\u2713', '#10b981', tab.id);
  } catch (err) {
    log.error('Capture failed', err);
    await showBadge('\u2717', '#ef4444', tab.id);
  }
});

// ---------------------------------------------------------------------------
// Message routing (popup ↔ service worker ↔ content script)
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(
  (
    message: { type: string; [key: string]: unknown },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => {
    // Wrap in async IIFE so we can await
    (async () => {
      try {
        switch (message.type) {
          // --- Capture operations ---

          case 'capture_current_tab': {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) {
              sendResponse({ success: false, error: 'No active tab' });
              return;
            }
            const capture = await engine.capture(tab.id, message.options as any);
            sendResponse({ success: true, capture });
            break;
          }

          case 'update_annotations': {
            const capture = await engine.updateAnnotations(
              message.captureId as string,
              message.updates as any,
            );
            sendResponse({ success: !!capture, capture });
            break;
          }

          // --- Query operations ---

          case 'get_capture': {
            const capture = await storage.get(message.id as string);
            sendResponse({ success: true, capture });
            break;
          }

          case 'query_captures': {
            const captures = await storage.query(message.filter as any ?? {});
            sendResponse({ success: true, captures });
            break;
          }

          case 'get_recent': {
            const captures = await storage.query({
              limit: (message.limit as number) ?? 10,
              sortBy: 'createdAt',
              sortOrder: 'desc',
            });
            sendResponse({ success: true, captures });
            break;
          }

          case 'get_all_tags': {
            const stats = await storage.getStats();
            sendResponse({ success: true, tags: Object.keys(stats.tagCounts).sort() });
            break;
          }

          case 'get_stats': {
            const stats = await storage.getStats();
            sendResponse({ success: true, stats });
            break;
          }

          // --- CRUD ---

          case 'delete_capture': {
            await storage.delete(message.id as string);
            sendResponse({ success: true });
            break;
          }

          // --- Data management ---

          case 'export_all': {
            const all = await storage.export();
            sendResponse({ success: true, captures: all });
            break;
          }

          case 'import_captures': {
            await storage.import(message.captures as any);
            sendResponse({ success: true });
            break;
          }

          case 'clear_all': {
            await storage.clear();
            sendResponse({ success: true });
            break;
          }

          // --- Config ---

          case 'get_config': {
            sendResponse({ success: true, config });
            break;
          }

          case 'update_config': {
            config = { ...config, ...(message.config as Partial<ExtensionConfig>) };
            await chrome.storage.sync.set({ sc_config: config });
            // Re-init storage if backend changed
            if (message.config && (message.config as any).storageBackend) {
              storage = await getStorageBackend(config.storageBackend);
              engine = new CaptureEngine(storage);
            }
            sendResponse({ success: true, config });
            break;
          }

          default:
            sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
        }
      } catch (err) {
        log.error(`Message handler error (${message.type})`, err);
        sendResponse({ success: false, error: String(err) });
      }
    })();

    // Return true to keep the sendResponse channel open for async
    return true;
  },
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function showBadge(text: string, color: string, tabId?: number): Promise<void> {
  const details: chrome.action.BadgeTextDetails = { text };
  if (tabId) details.tabId = tabId;
  await chrome.action.setBadgeText(details);
  await chrome.action.setBadgeBackgroundColor({ color, tabId });

  // Clear after 2 seconds
  setTimeout(async () => {
    try {
      await chrome.action.setBadgeText({ text: '', tabId });
    } catch {
      // tab may have closed
    }
  }, 2000);
}
