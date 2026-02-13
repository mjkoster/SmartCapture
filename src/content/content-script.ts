/**
 * Content script — injected into every page.
 *
 * Listens for messages from the background service worker and responds
 * with extracted metadata, classification, and selected text.
 */

import type { ExtractionResult } from '../types/capture';
import { MetadataExtractor } from './metadata-extractor';
import { ContentParser } from './content-parser';
import { PageClassifier } from '../classifier/classifier';

const metadataExtractor = new MetadataExtractor();
const contentParser = new ContentParser();
const classifier = new PageClassifier();

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(
  (
    message: { type: string },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => {
    switch (message.type) {
      case 'extract_all': {
        // Full extraction: basics + summary + classification + selected text
        try {
          const basics = metadataExtractor.extract();
          const summary = contentParser.parseContent();
          const classification = classifier.classify(document, window.location.href);
          const selectedText = window.getSelection()?.toString()?.trim() || undefined;

          const result: ExtractionResult = {
            basics,
            summary,
            classification,
            selectedText,
          };
          sendResponse({ success: true, data: result });
        } catch (err) {
          sendResponse({ success: false, error: String(err) });
        }
        break;
      }

      case 'get_selected_text': {
        const selectedText = window.getSelection()?.toString()?.trim() || '';
        sendResponse({ success: true, selectedText });
        break;
      }

      case 'ping': {
        // Health check — background can verify content script is loaded
        sendResponse({ success: true, ready: true });
        break;
      }

      default:
        sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
    }

    // Return true to indicate we will respond asynchronously
    return true;
  },
);
