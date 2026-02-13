/**
 * Smart Capture — Storage abstraction layer
 *
 * Defines the interface that all storage backends must implement,
 * plus query/filter types and statistics.
 */

import type { Capture, PageType } from './capture';

// ---------------------------------------------------------------------------
// Query and filter
// ---------------------------------------------------------------------------

export interface QueryFilter {
  ids?: string[];
  tags?: string[];              // match any tag (OR)
  type?: PageType;
  starred?: boolean;
  archived?: boolean;
  dateRange?: {
    start: string;              // ISO-8601
    end: string;
  };
  searchText?: string;          // full-text search across title/description/notes/excerpt
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface StorageStats {
  totalCaptures: number;
  storageUsedBytes: number;
  storageQuotaBytes: number;
  oldestCapture?: string;       // ISO-8601
  newestCapture?: string;       // ISO-8601
  tagCounts: Record<string, number>;
  typeCounts: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Storage backend interface
// ---------------------------------------------------------------------------

export interface IStorageBackend {
  /** Initialize the backend (open DB, warm cache, etc.) */
  init(): Promise<void>;

  /** Save a new capture or update an existing one (upsert by id) */
  save(capture: Capture): Promise<void>;

  /** Retrieve a single capture by id */
  get(id: string): Promise<Capture | null>;

  /** Query captures with optional filters, sorting, and pagination */
  query(filter: QueryFilter): Promise<Capture[]>;

  /** Delete a capture by id */
  delete(id: string): Promise<void>;

  /** Get storage usage statistics */
  getStats(): Promise<StorageStats>;

  /** Export all captures as an array */
  export(): Promise<Capture[]>;

  /** Import an array of captures (merge — existing ids are overwritten) */
  import(captures: Capture[]): Promise<void>;

  /** Delete all captures */
  clear(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Storage backend identifiers
// ---------------------------------------------------------------------------

export type StorageBackendType = 'chrome-local' | 'indexeddb';
