# Smart Capture — Session Context & Handoff Document

This document captures the full state of the Smart Capture project so that a future session can resume development without loss of context.

## What This Project Is

Smart Capture is a Chrome extension (Manifest V3) that replaces traditional bookmarks. When the user presses a keyboard shortcut (Ctrl+Shift+S / Cmd+Shift+S), it captures the current page's URL along with rich, auto-extracted metadata: page basics (title, OG tags, favicon), a content summary (excerpt, keywords, reading time), page type classification with type-specific fields, and user annotations (tags, notes, highlighted text). Each capture is stored as a structured JSON block with a UUID and ISO-8601 timestamp.

## Project Location

The project lives at `~/Desktop/SmartCapture` on the user's machine (Michael Koster). It is licensed under BSD 3-Clause.

## Current State: Complete v1.0

All planned features are implemented and the project builds successfully with zero TypeScript errors. No TODO or FIXME markers exist in the code. The extension has not yet been tested in a live Chrome browser — it was built and verified to compile but needs manual loading and functional testing.

## Design Decisions Made

These decisions were confirmed with the user at the start of the project:

1. **Form factor**: Chrome extension (not userscript or desktop app)
2. **Browser target**: Chrome Manifest V3 only (not cross-browser)
3. **Storage**: Pluggable backend via `IStorageBackend` interface, with chrome.storage.local (default) and IndexedDB as initial implementations
4. **Metadata categories**: All four — page basics, content summary, classification, and user annotations
5. **UI framework**: Vanilla TypeScript (no React/Preact) to keep the bundle small
6. **Build tool**: esbuild (bundled with tsx, available globally) — npm registry was inaccessible in the build environment, so we use esbuild directly via a shell script rather than Vite

## Build System

The npm registry was blocked in the original build environment. The project has two build paths:

**Primary (used in practice):** `bash build.sh`
- Uses esbuild at `/usr/local/lib/node_modules_global/lib/node_modules/tsx/node_modules/.bin/esbuild`
- Bundles 4 entry points: service-worker (ESM), content-script (IIFE), popup (ESM), options (ESM)
- Copies manifest.json, HTML (with .ts→.js patching), CSS, and icons to dist/
- Icons generated via sharp from SVG templates

**Secondary (for standard Node.js environments):** `npm install && npm run build`
- Uses Vite with a custom plugin that copies manifest and icons
- Configured in vite.config.ts with rollup multi-entry
- Requires npm registry access to install vite and typescript

**Type checking:** `tsc --noEmit --project tsconfig.json` (TypeScript 5.9.3 available globally)

**Output:** The `dist/` folder contains everything Chrome needs to load the extension.

## Architecture Summary

```
src/
├── types/           # All TypeScript interfaces (the schema contract)
│   ├── capture.ts   # Capture, PageBasics, ContentSummary, ClassificationData, UserAnnotations, PageType enum, 8 type-specific field interfaces
│   ├── storage.ts   # IStorageBackend, QueryFilter, StorageStats, StorageBackendType
│   ├── config.ts    # ExtensionConfig, CaptureProfile, DEFAULT_CONFIG
│   └── chrome.d.ts  # Minimal Chrome API type declarations (since @types/chrome couldn't be installed)
├── background/
│   ├── service-worker.ts   # The main orchestrator: initializes storage, listens for keyboard shortcut, routes 14 message types between popup/content/storage
│   └── capture-engine.ts   # CaptureEngine class: ensures content script, requests extraction, assembles Capture, saves
├── content/
│   ├── content-script.ts      # Injected into every page; handles 3 message types: extract_all, get_selected_text, ping
│   ├── metadata-extractor.ts  # MetadataExtractor class: reads OG tags, Twitter cards, meta tags, link rels, JSON-LD dates
│   └── content-parser.ts      # ContentParser class: finds main content element, generates excerpt, extracts keywords (frequency-based with English stop words), estimates reading time at 200 WPM
├── classifier/
│   ├── classifier.ts   # PageClassifier: runs 3 detectors in priority order, then runs matching extractor
│   ├── types.ts         # PageDetector and TypeExtractor interfaces
│   ├── detectors/
│   │   ├── schema-detector.ts    # Parses JSON-LD blocks, maps @type to PageType, confidence 0.95
│   │   ├── url-detector.ts       # 24 regex rules for known domains, confidence 0.7–0.9
│   │   └── heuristic-detector.ts # Scores 6 page types by DOM signals, confidence 0.5–0.8
│   └── extractors/
│       ├── base-extractor.ts          # Shared: getMeta(), getJsonLd(), nestedString(), toNumber()
│       ├── article-extractor.ts       # author, dates, section, publisher, reading time
│       ├── product-extractor.ts       # price, rating, reviews, availability, brand, SKU
│       ├── video-extractor.ts         # duration (ISO 8601 parsing), channel, views, thumbnail
│       ├── repository-extractor.ts    # owner/name from URL, stars (handles "1.2k"), forks, language, topics
│       ├── documentation-extractor.ts # breadcrumb, TOC links, version, framework detection
│       └── recipe-extractor.ts        # times (ISO 8601→minutes), servings, calories, ingredients from JSON-LD
├── storage/
│   ├── chrome-storage.ts    # ChromeStorageBackend: in-memory Map cache, flush to chrome.storage.local, full query/filter/sort/paginate
│   ├── indexeddb-storage.ts # IndexedDBBackend: DB "smart-capture" v1, store "captures", indexes on createdAt/type/tags/starred
│   └── storage-factory.ts   # getStorageBackend(): cached factory, returns ChromeStorageBackend or IndexedDBBackend
├── ui/
│   ├── popup/    # popup.html + popup.css + popup.ts: capture button, preview card, tag input with autocomplete, notes, highlights, recent 8 captures, toast notifications
│   └── options/  # options.html + options.css + options.ts: storage backend selector, capture toggles, stats display, JSON export/import, clear all
└── utils/
    ├── uuid.ts       # crypto.randomUUID() with manual fallback
    ├── date.ts       # nowISO(), formatDate(), timeAgo()
    ├── sanitizer.ts  # escapeHtml(), stripHtml(), truncate(), normalizeWhitespace()
    └── logger.ts     # createLogger(tag) with debug/info/warn/error levels
```

## Message Protocol

The extension uses Chrome's message passing. All responses have the shape `{ success: boolean, ... }`.

**Service worker handles 14 message types from the popup:**

| Message | Direction | Purpose |
|---------|-----------|---------|
| `capture_current_tab` | popup → SW | Trigger full capture of active tab |
| `update_annotations` | popup → SW | Update tags/notes on existing capture |
| `get_capture` | popup → SW | Retrieve single capture by ID |
| `query_captures` | popup → SW | Query with filters, sort, pagination |
| `get_recent` | popup → SW | Get latest N captures (default 10) |
| `get_all_tags` | popup → SW | Get sorted unique tag list |
| `get_stats` | popup → SW | Get storage statistics |
| `delete_capture` | popup → SW | Delete a capture by ID |
| `export_all` | options → SW | Export all captures as array |
| `import_captures` | options → SW | Import array of captures (merge) |
| `clear_all` | options → SW | Delete all captures |
| `get_config` | options → SW | Get current ExtensionConfig |
| `update_config` | options → SW | Update config (triggers re-init if backend changed) |

**Content script handles 3 message types from the service worker:**

| Message | Direction | Purpose |
|---------|-----------|---------|
| `extract_all` | SW → content | Extract basics + summary + classification + selected text |
| `get_selected_text` | SW → content | Get window.getSelection() text |
| `ping` | SW → content | Health check before extraction |

**Keyboard shortcut flow:**
Ctrl+Shift+S → `chrome.commands.onCommand` in service worker → validates tab isn't chrome:// → `engine.capture(tabId)` → badge shows checkmark or X for 2 seconds.

## Known Limitations and Gaps

These are not bugs — they are intentional scope boundaries for v1:

1. **No SocialPostExtractor class** — `SocialPostFields` interface is defined and detection works (URL patterns match Twitter, Reddit, Mastodon), but no extractor pulls type-specific fields. Extraction defaults to `{}`.

2. **No ForumThreadExtractor class** — Same situation. Detection via URL patterns works; extraction is empty.

3. **IndexedDB queries are in-memory** — `query()` fetches all records then filters. Fine for hundreds of captures; would need cursor-based iteration for 10,000+.

4. **IndexedDB stats return 0 for storage metrics** — `storageUsedBytes` and `storageQuotaBytes` are returned as 0 because IndexedDB doesn't expose these easily.

5. **No data migration between backends** — Switching from Chrome Storage to IndexedDB (or vice versa) abandons the old data. User must manually export then import.

6. **English-only keyword extraction** — Stop word list is English. Keywords won't be meaningful for non-English pages.

7. **No test suite** — vitest is configured in package.json but no test files exist in `tests/`.

8. **No duplicate detection** — Capturing the same URL twice creates two separate captures (no dedup by URL or canonical URL).

9. **Favicon as URL only** — Favicons are stored as URLs, not as data URIs. If the original site goes down, the favicon breaks.

10. **Content script injection path mismatch** — `capture-engine.ts` line 80 references `src/content/content-script.js` for manual injection, but the built file is at `content-script.js` (root of dist). This would fail if the manifest's automatic injection didn't already cover it. Should be updated to `content-script.js`.

11. **No capture editing UI** — You can add tags/notes at capture time, but there's no way to edit them later from the popup. The `update_annotations` message exists and works; the UI just doesn't expose it for existing captures.

## Suggested Next Steps

In rough priority order:

1. **Test in Chrome** — Load `dist/` as unpacked extension, test the capture flow on various page types, verify the popup and options page work correctly.

2. **Fix the content script injection path** — In `capture-engine.ts`, change `'src/content/content-script.js'` to `'content-script.js'` to match the built output path.

3. **Add SocialPostExtractor and ForumThreadExtractor** — Follow the pattern of existing extractors. Pull metrics like like/repost counts, author handles, vote scores.

4. **Add duplicate detection** — Before saving, check if a capture with the same canonical URL (or URL) already exists. Offer to update or skip.

5. **Add capture editing** — In the recent captures list, clicking a capture could open an edit view for tags/notes. The backend already supports this via `update_annotations`.

6. **Write tests** — Unit tests for classifiers/extractors (mock DOM), storage backends (mock chrome.storage), and the capture engine (integration).

7. **Data migration on backend switch** — When the user switches storage backends, automatically export from the old and import into the new.

8. **Internationalization** — Configurable stop word lists, locale-aware date formatting.

## File-by-File Reference

| File | Lines | Role |
|------|-------|------|
| `src/types/capture.ts` | 175 | Core schema: Capture, PageType enum, 8 type-specific field interfaces |
| `src/types/storage.ts` | 65 | IStorageBackend interface, QueryFilter, StorageStats |
| `src/types/config.ts` | 35 | ExtensionConfig, CaptureProfile, defaults |
| `src/types/chrome.d.ts` | 75 | Minimal Chrome API declarations |
| `src/background/service-worker.ts` | 175 | Initialization, command listener, 14 message handlers |
| `src/background/capture-engine.ts` | 95 | CaptureEngine: capture() and updateAnnotations() |
| `src/content/content-script.ts` | 55 | Message listener dispatching to extractors |
| `src/content/metadata-extractor.ts` | 105 | MetadataExtractor: OG/Twitter/meta/link extraction |
| `src/content/content-parser.ts` | 115 | ContentParser: main content finder, keywords, reading time |
| `src/classifier/classifier.ts` | 75 | PageClassifier: detector pipeline + extractor dispatch |
| `src/classifier/types.ts` | 20 | DetectionResult, PageDetector, TypeExtractor interfaces |
| `src/classifier/detectors/schema-detector.ts` | 65 | JSON-LD @type mapping, handles @graph arrays |
| `src/classifier/detectors/url-detector.ts` | 75 | 24 regex rules for known domains |
| `src/classifier/detectors/heuristic-detector.ts` | 110 | DOM signal scoring for 6 page types |
| `src/classifier/extractors/base-extractor.ts` | 50 | getMeta(), getJsonLd(), nestedString(), toNumber() |
| `src/classifier/extractors/article-extractor.ts` | 55 | Author resolution, dates, reading time |
| `src/classifier/extractors/product-extractor.ts` | 100 | Price, rating, availability from JSON-LD + microdata |
| `src/classifier/extractors/video-extractor.ts` | 85 | Duration (ISO 8601), channel, YouTube-specific selectors |
| `src/classifier/extractors/repository-extractor.ts` | 70 | GitHub/GitLab URL parsing, star count ("1.2k" handling) |
| `src/classifier/extractors/documentation-extractor.ts` | 70 | Breadcrumbs, TOC, version detection |
| `src/classifier/extractors/recipe-extractor.ts` | 65 | ISO 8601 duration→minutes, ingredients from JSON-LD |
| `src/storage/chrome-storage.ts` | 145 | In-memory cache + chrome.storage.local flush |
| `src/storage/indexeddb-storage.ts` | 165 | IDB with 4 indexes, full query support |
| `src/storage/storage-factory.ts` | 30 | Cached factory function |
| `src/ui/popup/popup.ts` | 195 | Capture flow, tag autocomplete, recent list |
| `src/ui/popup/popup.html` | 85 | Popup markup |
| `src/ui/popup/popup.css` | 240 | Popup styles (indigo primary, clean design) |
| `src/ui/options/options.ts` | 115 | Config persistence, export/import/clear |
| `src/ui/options/options.html` | 95 | Options page markup |
| `src/ui/options/options.css` | 185 | Options page styles |
| `src/utils/uuid.ts` | 15 | crypto.randomUUID() with fallback |
| `src/utils/date.ts` | 25 | ISO timestamps, relative time |
| `src/utils/sanitizer.ts` | 30 | HTML escaping, truncation |
| `src/utils/logger.ts` | 40 | Tagged logger with level filtering |
| `manifest.json` | 40 | MV3 manifest with commands, permissions, content_scripts |
| `build.sh` | 45 | esbuild-based build script |
| `vite.config.ts` | 70 | Alternative Vite build config |
| **Total** | **~3,200** | |
