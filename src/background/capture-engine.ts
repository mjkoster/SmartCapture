/**
 * CaptureEngine — orchestrates the end-to-end capture flow.
 *
 * Flow:
 *   1. Ensure content script is loaded in the target tab
 *   2. Send "extract_all" message to the content script
 *   3. Receive basics, summary, classification, and selected text
 *   4. Assemble a full Capture object with UUID + timestamp
 *   5. Merge any user-provided options (tags, notes)
 *   6. Save to the configured storage backend
 */

import type {
  Capture,
  CaptureOptions,
  ExtractionResult,
  PageType,
} from '../types/capture';
import type { IStorageBackend } from '../types/storage';
import { generateUUID } from '../utils/uuid';
import { nowISO } from '../utils/date';
import { createLogger } from '../utils/logger';

const log = createLogger('CaptureEngine');

export class CaptureEngine {
  constructor(private storage: IStorageBackend) {}

  /**
   * Perform a full capture of the given tab.
   * Returns the saved Capture object.
   */
  async capture(tabId: number, options: CaptureOptions = {}): Promise<Capture> {
    log.info(`Starting capture for tab ${tabId}`);

    // 1. Ensure content script is injected
    await this.ensureContentScript(tabId);

    // 2. Request extraction from the content script
    const extraction = await this.requestExtraction(tabId);

    // 3. Build the capture object
    const now = nowISO();
    const capture: Capture = {
      metadata: {
        id: generateUUID(),
        createdAt: now,
        updatedAt: now,
        profileId: options.profileId,
      },
      basics: extraction.basics,
      summary: extraction.summary,
      classification: extraction.classification,
      annotations: {
        tags: options.tags ?? [],
        notes: options.notes ?? '',
        highlights: extraction.selectedText
          ? [{ text: extraction.selectedText }]
          : [],
        starred: false,
        archived: false,
      },
    };

    // 4. Save
    await this.storage.save(capture);
    log.info(`Capture saved: ${capture.metadata.id} (${capture.classification.type})`);

    return capture;
  }

  /**
   * Update an existing capture's annotations (tags, notes, starred, etc.).
   */
  async updateAnnotations(
    captureId: string,
    updates: Partial<Capture['annotations']>,
  ): Promise<Capture | null> {
    const existing = await this.storage.get(captureId);
    if (!existing) {
      log.warn(`Cannot update — capture ${captureId} not found`);
      return null;
    }

    existing.annotations = { ...existing.annotations, ...updates };
    existing.metadata.updatedAt = nowISO();
    await this.storage.save(existing);

    log.info(`Updated annotations for ${captureId}`);
    return existing;
  }

  // ---- internal ----

  /**
   * Ensure the content script is injected into the tab.
   * In MV3 with content_scripts in the manifest, the script should already
   * be injected. This sends a "ping" to verify and injects manually if needed.
   */
  private async ensureContentScript(tabId: number): Promise<void> {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'ping' });
      if (response?.success) return;
    } catch {
      // Content script not loaded — inject it
      log.info(`Injecting content script into tab ${tabId}`);
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['src/content/content-script.js'],
      });
    }
  }

  /**
   * Request the content script to extract all metadata.
   */
  private async requestExtraction(tabId: number): Promise<ExtractionResult> {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'extract_all' });

    if (!response?.success) {
      throw new Error(`Extraction failed: ${response?.error ?? 'unknown error'}`);
    }

    return response.data as ExtractionResult;
  }
}
