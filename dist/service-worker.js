var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/types/config.ts
var DEFAULT_PROFILE = {
  id: "default",
  name: "Default",
  defaultTags: [],
  autoClassify: true,
  extractContent: true,
  extractKeywords: true
};
var DEFAULT_CONFIG = {
  storageBackend: "chrome-local",
  activeProfileId: "default",
  profiles: [DEFAULT_PROFILE],
  autoClassify: true,
  extractContent: true,
  extractKeywords: true
};

// src/utils/uuid.ts
function generateUUID() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}

// src/utils/date.ts
function nowISO() {
  return (/* @__PURE__ */ new Date()).toISOString();
}

// src/utils/logger.ts
var LEVEL_PRIORITY = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};
var currentLevel = "info";
function shouldLog(level) {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
}
function log(level, tag, message, data) {
  if (!shouldLog(level)) return;
  const prefix = `[SmartCapture:${tag}]`;
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : level === "debug" ? console.debug : console.log;
  if (data !== void 0) {
    fn(prefix, message, data);
  } else {
    fn(prefix, message);
  }
}
function createLogger(tag) {
  return {
    debug: (msg, data) => log("debug", tag, msg, data),
    info: (msg, data) => log("info", tag, msg, data),
    warn: (msg, data) => log("warn", tag, msg, data),
    error: (msg, data) => log("error", tag, msg, data)
  };
}

// src/background/capture-engine.ts
var log2 = createLogger("CaptureEngine");
var CaptureEngine = class {
  constructor(storage2) {
    this.storage = storage2;
  }
  /**
   * Perform a full capture of the given tab.
   * Returns the saved Capture object.
   */
  async capture(tabId, options = {}) {
    log2.info(`Starting capture for tab ${tabId}`);
    await this.ensureContentScript(tabId);
    const extraction = await this.requestExtraction(tabId);
    const now = nowISO();
    const capture = {
      metadata: {
        id: generateUUID(),
        createdAt: now,
        updatedAt: now,
        profileId: options.profileId
      },
      basics: extraction.basics,
      summary: extraction.summary,
      classification: extraction.classification,
      annotations: {
        tags: options.tags ?? [],
        notes: options.notes ?? "",
        highlights: extraction.selectedText ? [{ text: extraction.selectedText }] : [],
        starred: false,
        archived: false
      }
    };
    await this.storage.save(capture);
    log2.info(`Capture saved: ${capture.metadata.id} (${capture.classification.type})`);
    return capture;
  }
  /**
   * Update an existing capture's annotations (tags, notes, starred, etc.).
   */
  async updateAnnotations(captureId, updates) {
    const existing = await this.storage.get(captureId);
    if (!existing) {
      log2.warn(`Cannot update \u2014 capture ${captureId} not found`);
      return null;
    }
    existing.annotations = { ...existing.annotations, ...updates };
    existing.metadata.updatedAt = nowISO();
    await this.storage.save(existing);
    log2.info(`Updated annotations for ${captureId}`);
    return existing;
  }
  // ---- internal ----
  /**
   * Ensure the content script is injected into the tab.
   * In MV3 with content_scripts in the manifest, the script should already
   * be injected. This sends a "ping" to verify and injects manually if needed.
   */
  async ensureContentScript(tabId) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: "ping" });
      if (response?.success) return;
    } catch {
      log2.info(`Injecting content script into tab ${tabId}`);
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["src/content/content-script.js"]
      });
    }
  }
  /**
   * Request the content script to extract all metadata.
   */
  async requestExtraction(tabId) {
    const response = await chrome.tabs.sendMessage(tabId, { type: "extract_all" });
    if (!response?.success) {
      throw new Error(`Extraction failed: ${response?.error ?? "unknown error"}`);
    }
    return response.data;
  }
};

// src/storage/chrome-storage.ts
var log3 = createLogger("ChromeStorage");
var CAPTURES_KEY = "sc_captures";
var ChromeStorageBackend = class {
  constructor() {
    __publicField(this, "cache", /* @__PURE__ */ new Map());
  }
  async init() {
    log3.info("Initializing chrome.storage.local backend");
    const data = await chrome.storage.local.get(CAPTURES_KEY);
    const captures = data[CAPTURES_KEY] || [];
    this.cache.clear();
    for (const c of captures) {
      this.cache.set(c.metadata.id, c);
    }
    log3.info(`Loaded ${this.cache.size} captures from storage`);
  }
  async save(capture) {
    this.cache.set(capture.metadata.id, capture);
    await this.flush();
    log3.debug("Saved capture", capture.metadata.id);
  }
  async get(id) {
    return this.cache.get(id) ?? null;
  }
  async query(filter) {
    let results = Array.from(this.cache.values());
    if (filter.ids?.length) {
      const idSet = new Set(filter.ids);
      results = results.filter((c) => idSet.has(c.metadata.id));
    }
    if (filter.tags?.length) {
      results = results.filter(
        (c) => filter.tags.some((tag) => c.annotations.tags.includes(tag))
      );
    }
    if (filter.type) {
      results = results.filter((c) => c.classification.type === filter.type);
    }
    if (filter.starred !== void 0) {
      results = results.filter((c) => c.annotations.starred === filter.starred);
    }
    if (filter.archived !== void 0) {
      results = results.filter((c) => c.annotations.archived === filter.archived);
    }
    if (filter.dateRange) {
      const { start, end } = filter.dateRange;
      results = results.filter((c) => {
        const t = c.metadata.createdAt;
        return t >= start && t <= end;
      });
    }
    if (filter.searchText) {
      const q = filter.searchText.toLowerCase();
      results = results.filter(
        (c) => c.basics.title.toLowerCase().includes(q) || c.basics.description?.toLowerCase().includes(q) || c.basics.url.toLowerCase().includes(q) || c.summary.excerpt?.toLowerCase().includes(q) || c.annotations.notes.toLowerCase().includes(q) || c.annotations.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    const sortBy = filter.sortBy ?? "createdAt";
    const sortOrder = filter.sortOrder ?? "desc";
    const multiplier = sortOrder === "desc" ? -1 : 1;
    results.sort((a, b) => {
      let va;
      let vb;
      if (sortBy === "title") {
        va = a.basics.title.toLowerCase();
        vb = b.basics.title.toLowerCase();
      } else if (sortBy === "updatedAt") {
        va = a.metadata.updatedAt;
        vb = b.metadata.updatedAt;
      } else {
        va = a.metadata.createdAt;
        vb = b.metadata.createdAt;
      }
      return va < vb ? -1 * multiplier : va > vb ? 1 * multiplier : 0;
    });
    const offset = filter.offset ?? 0;
    if (filter.limit) {
      results = results.slice(offset, offset + filter.limit);
    } else if (offset > 0) {
      results = results.slice(offset);
    }
    return results;
  }
  async delete(id) {
    this.cache.delete(id);
    await this.flush();
    log3.debug("Deleted capture", id);
  }
  async getStats() {
    const captures = Array.from(this.cache.values());
    const bytesInUse = await chrome.storage.local.getBytesInUse(CAPTURES_KEY);
    const tagCounts = {};
    const typeCounts = {};
    for (const c of captures) {
      for (const tag of c.annotations.tags) {
        tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
      }
      const t = c.classification.type;
      typeCounts[t] = (typeCounts[t] ?? 0) + 1;
    }
    let oldest;
    let newest;
    if (captures.length > 0) {
      const sorted = captures.map((c) => c.metadata.createdAt).sort();
      oldest = sorted[0];
      newest = sorted[sorted.length - 1];
    }
    return {
      totalCaptures: captures.length,
      storageUsedBytes: bytesInUse,
      storageQuotaBytes: chrome.storage.local.QUOTA_BYTES ?? 10 * 1024 * 1024,
      oldestCapture: oldest,
      newestCapture: newest,
      tagCounts,
      typeCounts
    };
  }
  async export() {
    return Array.from(this.cache.values());
  }
  async import(captures) {
    for (const c of captures) {
      this.cache.set(c.metadata.id, c);
    }
    await this.flush();
    log3.info(`Imported ${captures.length} captures`);
  }
  async clear() {
    this.cache.clear();
    await chrome.storage.local.remove(CAPTURES_KEY);
    log3.info("Cleared all captures");
  }
  // ---- internal ----
  async flush() {
    const arr = Array.from(this.cache.values());
    await chrome.storage.local.set({ [CAPTURES_KEY]: arr });
  }
};

// src/storage/indexeddb-storage.ts
var log4 = createLogger("IndexedDB");
var DB_NAME = "smart-capture";
var DB_VERSION = 1;
var STORE_NAME = "captures";
var IndexedDBBackend = class {
  constructor() {
    __publicField(this, "db", null);
  }
  async init() {
    log4.info("Opening IndexedDB");
    this.db = await this.openDB();
    log4.info("IndexedDB ready");
  }
  async save(capture) {
    const store = this.txn("readwrite");
    return new Promise((resolve, reject) => {
      const req = store.put(capture);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
  async get(id) {
    const store = this.txn("readonly");
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }
  async query(filter) {
    const all = await this.getAll();
    let results = all;
    if (filter.ids?.length) {
      const idSet = new Set(filter.ids);
      results = results.filter((c) => idSet.has(c.metadata.id));
    }
    if (filter.tags?.length) {
      results = results.filter(
        (c) => filter.tags.some((tag) => c.annotations.tags.includes(tag))
      );
    }
    if (filter.type) {
      results = results.filter((c) => c.classification.type === filter.type);
    }
    if (filter.starred !== void 0) {
      results = results.filter((c) => c.annotations.starred === filter.starred);
    }
    if (filter.archived !== void 0) {
      results = results.filter((c) => c.annotations.archived === filter.archived);
    }
    if (filter.dateRange) {
      const { start, end } = filter.dateRange;
      results = results.filter((c) => {
        const t = c.metadata.createdAt;
        return t >= start && t <= end;
      });
    }
    if (filter.searchText) {
      const q = filter.searchText.toLowerCase();
      results = results.filter(
        (c) => c.basics.title.toLowerCase().includes(q) || c.basics.description?.toLowerCase().includes(q) || c.basics.url.toLowerCase().includes(q) || c.summary.excerpt?.toLowerCase().includes(q) || c.annotations.notes.toLowerCase().includes(q) || c.annotations.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    const sortBy = filter.sortBy ?? "createdAt";
    const sortOrder = filter.sortOrder ?? "desc";
    const m = sortOrder === "desc" ? -1 : 1;
    results.sort((a, b) => {
      let va, vb;
      if (sortBy === "title") {
        va = a.basics.title.toLowerCase();
        vb = b.basics.title.toLowerCase();
      } else if (sortBy === "updatedAt") {
        va = a.metadata.updatedAt;
        vb = b.metadata.updatedAt;
      } else {
        va = a.metadata.createdAt;
        vb = b.metadata.createdAt;
      }
      return va < vb ? -1 * m : va > vb ? 1 * m : 0;
    });
    const offset = filter.offset ?? 0;
    if (filter.limit) {
      results = results.slice(offset, offset + filter.limit);
    } else if (offset > 0) {
      results = results.slice(offset);
    }
    return results;
  }
  async delete(id) {
    const store = this.txn("readwrite");
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
  async getStats() {
    const captures = await this.getAll();
    const tagCounts = {};
    const typeCounts = {};
    for (const c of captures) {
      for (const tag of c.annotations.tags) {
        tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
      }
      const t = c.classification.type;
      typeCounts[t] = (typeCounts[t] ?? 0) + 1;
    }
    const sorted = captures.map((c) => c.metadata.createdAt).sort();
    return {
      totalCaptures: captures.length,
      storageUsedBytes: 0,
      // IndexedDB doesn't expose this easily
      storageQuotaBytes: 0,
      oldestCapture: sorted[0],
      newestCapture: sorted[sorted.length - 1],
      tagCounts,
      typeCounts
    };
  }
  async export() {
    return this.getAll();
  }
  async import(captures) {
    const store = this.txn("readwrite");
    for (const c of captures) {
      store.put(c);
    }
    return new Promise((resolve, reject) => {
      store.transaction.oncomplete = () => resolve();
      store.transaction.onerror = () => reject(store.transaction.error);
    });
  }
  async clear() {
    const store = this.txn("readwrite");
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
  // ---- internal ----
  openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: "metadata.id"
          });
          store.createIndex("createdAt", "metadata.createdAt", { unique: false });
          store.createIndex("type", "classification.type", { unique: false });
          store.createIndex("tags", "annotations.tags", { multiEntry: true });
          store.createIndex("starred", "annotations.starred", { unique: false });
        }
      };
    });
  }
  txn(mode) {
    if (!this.db) throw new Error("IndexedDB not initialized \u2014 call init() first");
    return this.db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
  }
  getAll() {
    const store = this.txn("readonly");
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
};

// src/storage/storage-factory.ts
var instances = /* @__PURE__ */ new Map();
async function getStorageBackend(type = "chrome-local") {
  const existing = instances.get(type);
  if (existing) return existing;
  let backend;
  switch (type) {
    case "indexeddb":
      backend = new IndexedDBBackend();
      break;
    case "chrome-local":
    default:
      backend = new ChromeStorageBackend();
      break;
  }
  await backend.init();
  instances.set(type, backend);
  return backend;
}

// src/background/service-worker.ts
var log5 = createLogger("ServiceWorker");
var storage;
var engine;
var config;
async function initialize() {
  log5.info("Initializing Smart Capture");
  const stored = await chrome.storage.sync.get("sc_config");
  config = stored.sc_config ?? DEFAULT_CONFIG;
  storage = await getStorageBackend(config.storageBackend);
  engine = new CaptureEngine(storage);
  log5.info(`Ready \u2014 storage: ${config.storageBackend}`);
}
chrome.runtime.onInstalled.addListener(() => {
  initialize().catch((err) => log5.error("Init failed on install", err));
});
initialize().catch((err) => log5.error("Init failed", err));
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "trigger-capture") return;
  log5.info("Capture triggered via keyboard shortcut");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) {
    log5.warn("No active tab with URL");
    return;
  }
  if (tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) {
    log5.warn("Cannot capture chrome:// or extension pages");
    await showBadge("!", "#ef4444", tab.id);
    return;
  }
  try {
    await engine.capture(tab.id);
    await showBadge("\u2713", "#10b981", tab.id);
  } catch (err) {
    log5.error("Capture failed", err);
    await showBadge("\u2717", "#ef4444", tab.id);
  }
});
chrome.runtime.onMessage.addListener(
  (message, _sender, sendResponse) => {
    (async () => {
      try {
        switch (message.type) {
          // --- Capture operations ---
          case "capture_current_tab": {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) {
              sendResponse({ success: false, error: "No active tab" });
              return;
            }
            const capture = await engine.capture(tab.id, message.options);
            sendResponse({ success: true, capture });
            break;
          }
          case "update_annotations": {
            const capture = await engine.updateAnnotations(
              message.captureId,
              message.updates
            );
            sendResponse({ success: !!capture, capture });
            break;
          }
          // --- Query operations ---
          case "get_capture": {
            const capture = await storage.get(message.id);
            sendResponse({ success: true, capture });
            break;
          }
          case "query_captures": {
            const captures = await storage.query(message.filter ?? {});
            sendResponse({ success: true, captures });
            break;
          }
          case "get_recent": {
            const captures = await storage.query({
              limit: message.limit ?? 10,
              sortBy: "createdAt",
              sortOrder: "desc"
            });
            sendResponse({ success: true, captures });
            break;
          }
          case "get_all_tags": {
            const stats = await storage.getStats();
            sendResponse({ success: true, tags: Object.keys(stats.tagCounts).sort() });
            break;
          }
          case "get_stats": {
            const stats = await storage.getStats();
            sendResponse({ success: true, stats });
            break;
          }
          // --- CRUD ---
          case "delete_capture": {
            await storage.delete(message.id);
            sendResponse({ success: true });
            break;
          }
          // --- Data management ---
          case "export_all": {
            const all = await storage.export();
            sendResponse({ success: true, captures: all });
            break;
          }
          case "import_captures": {
            await storage.import(message.captures);
            sendResponse({ success: true });
            break;
          }
          case "clear_all": {
            await storage.clear();
            sendResponse({ success: true });
            break;
          }
          // --- Config ---
          case "get_config": {
            sendResponse({ success: true, config });
            break;
          }
          case "update_config": {
            config = { ...config, ...message.config };
            await chrome.storage.sync.set({ sc_config: config });
            if (message.config && message.config.storageBackend) {
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
        log5.error(`Message handler error (${message.type})`, err);
        sendResponse({ success: false, error: String(err) });
      }
    })();
    return true;
  }
);
async function showBadge(text, color, tabId) {
  const details = { text };
  if (tabId) details.tabId = tabId;
  await chrome.action.setBadgeText(details);
  await chrome.action.setBadgeBackgroundColor({ color, tabId });
  setTimeout(async () => {
    try {
      await chrome.action.setBadgeText({ text: "", tabId });
    } catch {
    }
  }, 2e3);
}
