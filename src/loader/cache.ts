// IndexedDB cache for the built dictionary index. First open pays the
// build; subsequent opens read the finished structure back via structured
// clone. The stored version comes from public/data/manifest.json, so a
// re-bake invalidates the cache automatically. This cache stores the
// dictionary index only; game progress storage is a later prompt.
import type { Dictionaries } from '../engine/dictionary';

const DB_NAME = 'out-of-sorts';
const STORE = 'dictionary-index';
const KEY = 'current';

export interface CachedIndex {
  version: string;
  dicts: Dictionaries;
}

export interface IndexCache {
  get(): Promise<CachedIndex | undefined>;
  put(version: string, dicts: Dictionaries): Promise<void>;
  clear(): Promise<void>;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function openIndexCache(): Promise<IndexCache> {
  const openReq = indexedDB.open(DB_NAME, 1);
  openReq.onupgradeneeded = () => {
    openReq.result.createObjectStore(STORE);
  };
  const db = await request(openReq as IDBRequest<IDBDatabase>);

  const store = (mode: IDBTransactionMode) =>
    db.transaction(STORE, mode).objectStore(STORE);

  return {
    async get() {
      const value = await request(store('readonly').get(KEY));
      return value as CachedIndex | undefined;
    },
    async put(version, dicts) {
      await request(store('readwrite').put({ version, dicts }, KEY));
    },
    async clear() {
      await request(store('readwrite').delete(KEY));
    },
  };
}
