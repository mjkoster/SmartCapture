/**
 * Chrome storage.local backend implementation.
 *
 * Uses an in-memory Map as a cache to avoid repeated deserialization.
 * All mutations are written through to chrome.storage.local.
 *
 * Limits: ~10 MB total (QUOTA_BYTES for chrome.storage.local).
 */

import type { Capture, PageType } from '../types/capture';
import type { IStorageBackend, QueryFilter, StorageStats } from '../types/storage';
import { createLogger } from '../utils/logger';

const log = createLogger('ChromeStorage');

const CAPTURES_KEY = 'sc_captures';

export class ChromeStorageBackend implements IStorageBackend {
  private cache: Map<string, Capture> = new Map();

  async init(): Promise<void> {
    log.info('Initializing chrome.storage.local backend');
    const data = await chrome.storage.local.get(CAPTURES_KEY);
    const captures: Capture[] = data[CAPTURES_KEY] || [];
    this.cache.clear();
    for (const c of captures) {
      this.cache.set(c.metadata.id, c);
    }
    log.info(`Loaded ${this.cache.size} captures from storage`);
  }

  async save(capture: Capture): Promise<void> {
    this.cache.set(capture.metadata.id, capture);
    await this.flush();
    log.debug('Saved capture', capture.metadata.id);
  }

  async get(id: string): Promise<Capture | null> {
    return this.cache.get(id) ?? null;
  }

  async query(filter: QueryFilter): Promise<Capture[]> {
    let results = Array.from(this.cache.values());

    // Filter by IDs
    if (filter.ids?.length) {
      const idSet = new Set(filter.ids);
      results = results.filter((c) => idSet.has(c.metadata.id));
    }

    // Filter by tags (OR match)
    if (filter.tags?.length) {
      results = results.filter((c) =>
        filter.tags!.some((tag) => c.annotations.tags.includes(tag)),
      );
    }

    // Filter by page type
    if (filter.type) {
      results = results.filter((c) => c.classification.type === filter.type);
    }

    // Filter by starred
    if (filter.starred !== undefined) {
      results = results.filter((c) => c.annotations.starred === filter.starred);
    }

    // Filter by archived
    if (filter.archived !== undefined) {
      results = results.filter((c) => c.annotations.archived === filter.archived);
    }

    // Filter by date range
    if (filter.dateRange) {
      const { start, end } = filter.dateRange;
      results = results.filter((c) => {
        const t = c.metadata.createdAt;
        return t >= start && t <= end;
      });
    }

    // Full-text search
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
    const multiplier = sortOrder === 'desc' ? -1 : 1;

    results.sort((a, b) => {
      let va: string;
      let vb: string;
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
      return va < vb ? -1 * multiplier : va > vb ? 1 * multiplier : 0;
    });

    // Pagination
    const offset = filter.offset ?? 0;
    if (filter.limit) {
      results = results.slice(offset, offset + filter.limit);
    } else if (offset > 0) {
      results = results.slice(offset);
    }

    return results;
  }

  async delete(id: string): Promise<void> {
    this.cache.delete(id);
    await this.flush();
    log.debug('Deleted capture', id);
  }

  async getStats(): Promise<StorageStats> {
    const captures = Array.from(this.cache.values());
    const bytesInUse = await chrome.storage.local.getBytesInUse(CAPTURES_KEY);

    const tagCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};

    for (const c of captures) {
      // Tags
      for (const tag of c.annotations.tags) {
        tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
      }
      // Types
      const t = c.classification.type;
      typeCounts[t] = (typeCounts[t] ?? 0) + 1;
    }

    let oldest: string | undefined;
    let newest: string | undefined;
    if (captures.length > 0) {
      const sorted = captures
        .map((c) => c.metadata.createdAt)
        .sort();
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
      typeCounts,
    };
  }

  async export(): Promise<Capture[]> {
    return Array.from(this.cache.values());
  }

  async import(captures: Capture[]): Promise<void> {
    for (const c of captures) {
      this.cache.set(c.metadata.id, c);
    }
    await this.flush();
    log.info(`Imported ${captures.length} captures`);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    await chrome.storage.local.remove(CAPTURES_KEY);
    log.info('Cleared all captures');
  }

  // ---- internal ----

  private async flush(): Promise<void> {
    const arr = Array.from(this.cache.values());
    await chrome.storage.local.set({ [CAPTURES_KEY]: arr });
  }
}
