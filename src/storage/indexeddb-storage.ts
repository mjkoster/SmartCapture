/**
 * IndexedDB storage backend.
 *
 * Better suited for large collections (hundreds / thousands of captures).
 * Supports indexed queries on createdAt, type, and tags.
 */

import type { Capture } from '../types/capture';
import type { IStorageBackend, QueryFilter, StorageStats } from '../types/storage';
import { createLogger } from '../utils/logger';

const log = createLogger('IndexedDB');

const DB_NAME = 'smart-capture';
const DB_VERSION = 1;
const STORE_NAME = 'captures';

export class IndexedDBBackend implements IStorageBackend {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    log.info('Opening IndexedDB');
    this.db = await this.openDB();
    log.info('IndexedDB ready');
  }

  async save(capture: Capture): Promise<void> {
    const store = this.txn('readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(capture);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async get(id: string): Promise<Capture | null> {
    const store = this.txn('readonly');
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async query(filter: QueryFilter): Promise<Capture[]> {
    // Fetch all records, then filter in memory.
    // For very large datasets a cursor-based approach would be better,
    // but this keeps the code straightforward for v1.
    const all = await this.getAll();
    let results = all;

    if (filter.ids?.length) {
      const idSet = new Set(filter.ids);
      results = results.filter((c) => idSet.has(c.metadata.id));
    }
    if (filter.tags?.length) {
      results = results.filter((c) =>
        filter.tags!.some((tag) => c.annotations.tags.includes(tag)),
      );
    }
    if (filter.type) {
      results = results.filter((c) => c.classification.type === filter.type);
    }
    if (filter.starred !== undefined) {
      results = results.filter((c) => c.annotations.starred === filter.starred);
    }
    if (filter.archived !== undefined) {
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
      results = results.filter((c) =>
        c.basics.title.toLowerCase().includes(q) ||
        c.basics.description?.toLowerCase().includes(q) ||
        c.basics.url.toLowerCase().includes(q) ||
        c.summary.excerpt?.toLowerCase().includes(q) ||
        c.annotations.notes.toLowerCase().includes(q) ||
        c.annotations.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    // Sort
    const sortBy = filter.sortBy ?? 'createdAt';
    const sortOrder = filter.sortOrder ?? 'desc';
    const m = sortOrder === 'desc' ? -1 : 1;
    results.sort((a, b) => {
      let va: string, vb: string;
      if (sortBy === 'title') {
        va = a.basics.title.toLowerCase();
        vb = b.basics.title.toLowerCase();
      } else if (sortBy === 'updatedAt') {
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

  async delete(id: string): Promise<void> {
    const store = this.txn('readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getStats(): Promise<StorageStats> {
    const captures = await this.getAll();
    const tagCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};

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
      storageUsedBytes: 0, // IndexedDB doesn't expose this easily
      storageQuotaBytes: 0,
      oldestCapture: sorted[0],
      newestCapture: sorted[sorted.length - 1],
      tagCounts,
      typeCounts,
    };
  }

  async export(): Promise<Capture[]> {
    return this.getAll();
  }

  async import(captures: Capture[]): Promise<void> {
    const store = this.txn('readwrite');
    for (const c of captures) {
      store.put(c);
    }
    return new Promise((resolve, reject) => {
      store.transaction.oncomplete = () => resolve();
      store.transaction.onerror = () => reject(store.transaction.error);
    });
  }

  async clear(): Promise<void> {
    const store = this.txn('readwrite');
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ---- internal ----

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'metadata.id',
          });
          store.createIndex('createdAt', 'metadata.createdAt', { unique: false });
          store.createIndex('type', 'classification.type', { unique: false });
          store.createIndex('tags', 'annotations.tags', { multiEntry: true });
          store.createIndex('starred', 'annotations.starred', { unique: false });
        }
      };
    });
  }

  private txn(mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) throw new Error('IndexedDB not initialized — call init() first');
    return this.db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
  }

  private getAll(): Promise<Capture[]> {
    const store = this.txn('readonly');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
}
