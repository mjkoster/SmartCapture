# Smart Capture

A Chrome extension that replaces traditional bookmarks with rich, structured captures. Press a keyboard shortcut on any page to save the URL along with auto-extracted metadata — page basics, a content summary, keywords, page type classification with type-specific fields, and your own tags, notes, and highlights.

## Installation

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `dist/` folder inside this project

The extension icon ("SC") will appear in the toolbar. The default capture shortcut is **Ctrl+Shift+S** (or **Cmd+Shift+S** on Mac). You can change this at `chrome://extensions/shortcuts`.

## How It Works

When you trigger a capture, the extension:

1. Injects a content script into the active tab
2. Extracts **page basics** — title, description, favicon, Open Graph tags, canonical URL, author, published date
3. Generates a **content summary** — an excerpt from the main body text, top keywords by frequency, word count, and estimated reading time
4. **Classifies the page type** using a three-tier detection pipeline (schema.org → URL patterns → DOM heuristics) and runs a type-specific extractor to pull structured fields
5. Captures any **highlighted text** on the page
6. Opens the popup for you to add **tags** and **notes**
7. Saves the complete capture as a structured data block with a UUID and ISO-8601 timestamp

## Supported Page Types

Each detected type has its own extractor that pulls relevant fields:

| Type | Example Sites | Extracted Fields |
|------|--------------|-----------------|
| **Article** | News sites, blogs, Medium | author, published/modified dates, section, publisher, reading time |
| **Product** | Amazon, eBay, Etsy | name, price, currency, rating, review count, availability, brand, SKU |
| **Video** | YouTube, Vimeo, Twitch | title, duration, channel, upload date, view count, thumbnail, embed URL |
| **Repository** | GitHub, GitLab, Bitbucket | owner, name, stars, forks, language, license, topics, description |
| **Documentation** | ReadTheDocs, MDN, framework docs | section title, breadcrumb, table of contents, version, framework |
| **Recipe** | AllRecipes, Epicurious | name, prep/cook/total time, servings, calories, ingredients, cuisine |
| **Social Post** | Twitter/X, Reddit, Mastodon | author handle, post date, likes, reposts, replies, platform |
| **Forum Thread** | StackOverflow, HN, Discourse | title, author, votes, answer count, answered status, tags |

Pages that don't match any type are saved as **Unknown** with the standard metadata.

## Capture Schema

Each capture follows this structure:

```json
{
  "metadata": {
    "id": "uuid-v4",
    "createdAt": "2026-02-13T12:00:00.000Z",
    "updatedAt": "2026-02-13T12:00:00.000Z",
    "profileId": "default"
  },
  "basics": {
    "title": "Page Title",
    "description": "Meta description",
    "favicon": "https://example.com/favicon.ico",
    "url": "https://example.com/page",
    "canonicalUrl": "https://example.com/page",
    "author": "Author Name",
    "publishedDate": "2026-01-15",
    "ogImage": "https://example.com/image.jpg",
    "ogType": "article",
    "ogSiteName": "Example",
    "language": "en"
  },
  "summary": {
    "excerpt": "First 300 characters of main content...",
    "keywords": ["extracted", "keywords", "by", "frequency"],
    "readingTimeMinutes": 5,
    "wordCount": 1024
  },
  "classification": {
    "type": "article",
    "confidence": 0.95,
    "typeSpecificFields": {
      "author": "Author Name",
      "publishedDate": "2026-01-15",
      "section": "Technology",
      "readingTimeMinutes": 5
    }
  },
  "annotations": {
    "tags": ["user", "defined", "tags"],
    "notes": "User's notes about this page",
    "highlights": [{ "text": "Selected text from the page" }],
    "starred": false,
    "archived": false
  }
}
```

## Classification Pipeline

Detection runs three layers in priority order and stops at the first confident match:

1. **Schema.org detector** (confidence: 0.95) — parses `<script type="application/ld+json">` blocks and maps `@type` values to page types
2. **URL pattern detector** (confidence: 0.85–0.9) — matches the URL against regex rules for known domains (github.com, youtube.com, amazon.com, stackoverflow.com, etc.)
3. **Heuristic detector** (confidence: up to 0.8) — counts DOM signals like `<article>` tags, `[itemprop="price"]` attributes, `<video>` elements, recipe ingredient lists, and forum answer blocks

## Storage

Storage is pluggable via an abstract `IStorageBackend` interface. Two backends are included:

- **Chrome Storage** (default) — uses `chrome.storage.local`, up to 10 MB, fast and simple
- **IndexedDB** — better for large collections, indexed by timestamp, type, and tags

Switch between them in the options page. The interface (`save`, `get`, `query`, `delete`, `export`, `import`, `clear`) is designed so additional backends (REST API, file-based, cloud sync) can be added by implementing the same interface.

## Project Structure

```
SmartCapture/
├── src/
│   ├── types/
│   │   ├── capture.ts           # Core data schema and TypeScript interfaces
│   │   ├── storage.ts           # Storage backend interface, query filters
│   │   ├── config.ts            # Extension configuration types
│   │   └── chrome.d.ts          # Chrome API type declarations
│   ├── background/
│   │   ├── service-worker.ts    # MV3 service worker, command + message routing
│   │   └── capture-engine.ts    # Orchestrates the capture flow
│   ├── content/
│   │   ├── content-script.ts    # Injected into pages, handles extraction requests
│   │   ├── metadata-extractor.ts # Extracts title, OG tags, favicon, etc.
│   │   └── content-parser.ts    # Main content detection, keywords, reading time
│   ├── storage/
│   │   ├── chrome-storage.ts    # chrome.storage.local backend
│   │   ├── indexeddb-storage.ts # IndexedDB backend
│   │   └── storage-factory.ts   # Factory to instantiate configured backend
│   ├── classifier/
│   │   ├── classifier.ts        # Orchestrator: runs detectors, picks extractor
│   │   ├── types.ts             # Detector and extractor interfaces
│   │   ├── detectors/
│   │   │   ├── schema-detector.ts    # JSON-LD / schema.org
│   │   │   ├── url-detector.ts       # URL pattern matching
│   │   │   └── heuristic-detector.ts # DOM signal counting
│   │   └── extractors/
│   │       ├── base-extractor.ts     # Shared helpers
│   │       ├── article-extractor.ts
│   │       ├── product-extractor.ts
│   │       ├── video-extractor.ts
│   │       ├── repository-extractor.ts
│   │       ├── documentation-extractor.ts
│   │       └── recipe-extractor.ts
│   ├── ui/
│   │   ├── popup/               # Extension popup (capture + tag/note entry)
│   │   └── options/             # Settings page
│   └── utils/                   # UUID, date formatting, sanitization, logging
├── dist/                        # Built extension (load this in Chrome)
├── manifest.json                # Source manifest (copied to dist on build)
├── build.sh                     # Build script (uses esbuild)
└── tsconfig.json
```

## Building

The project uses [esbuild](https://esbuild.github.io/) to bundle TypeScript into self-contained JS files. Run:

```bash
bash build.sh
```

This produces the `dist/` folder with everything Chrome needs. The build bundles four entry points: `service-worker.js` (ESM), `content-script.js` (IIFE), `popup.js`, and `options.js`, plus the manifest, HTML, CSS, and icons.

For development with a standard Node.js setup, install dependencies and use the npm scripts:

```bash
npm install
npm run build       # one-time build
npm run dev         # watch mode (rebuild on changes)
```

## Extending

**Add a new page type:**
1. Add the type to the `PageType` enum in `src/types/capture.ts`
2. Define a fields interface (e.g., `PodcastFields`)
3. Create an extractor in `src/classifier/extractors/`
4. Add URL patterns to `src/classifier/detectors/url-detector.ts`
5. Add DOM heuristics to `src/classifier/detectors/heuristic-detector.ts`
6. Register the extractor in `src/classifier/classifier.ts`

**Add a new storage backend:**
1. Implement `IStorageBackend` from `src/types/storage.ts`
2. Add the backend type to `StorageBackendType`
3. Register it in `src/storage/storage-factory.ts`
4. Add a radio option in `src/ui/options/options.html`
