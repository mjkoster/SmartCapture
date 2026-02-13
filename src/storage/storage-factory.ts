/**
 * Factory for instantiating the configured storage backend.
 */

import type { IStorageBackend, StorageBackendType } from '../types/storage';
import { ChromeStorageBackend } from './chrome-storage';
import { IndexedDBBackend } from './indexeddb-storage';

const instances = new Map<StorageBackendType, IStorageBackend>();

/**
 * Get (or create) a storage backend instance by type.
 * The instance is cached so repeated calls return the same object.
 */
export async function getStorageBackend(
  type: StorageBackendType = 'chrome-local',
): Promise<IStorageBackend> {
  const existing = instances.get(type);
  if (existing) return existing;

  let backend: IStorageBackend;

  switch (type) {
    case 'indexeddb':
      backend = new IndexedDBBackend();
      break;
    case 'chrome-local':
    default:
      backend = new ChromeStorageBackend();
      break;
  }

  await backend.init();
  instances.set(type, backend);
  return backend;
}
