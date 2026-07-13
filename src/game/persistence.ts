// Run snapshots in local storage. Daily and Endless persist independently
// under their own keys; switching modes is a view change and never resets
// either. Words only: the engine replays them, so the engine stays the
// single source of truth for scores and state.
export interface RunSnapshot {
  rack: string;
  words: string[];
  stopped: boolean;
  endlessSeed?: number;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const PREFIX = 'oos:';

export function saveRunSnapshot(
  storage: KeyValueStorage,
  key: string,
  snapshot: RunSnapshot,
): void {
  storage.setItem(PREFIX + key, JSON.stringify(snapshot));
}

export function loadRunSnapshot(
  storage: KeyValueStorage,
  key: string,
): RunSnapshot | null {
  try {
    const raw = storage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RunSnapshot;
    if (typeof parsed.rack !== 'string' || !Array.isArray(parsed.words)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function loadJson<T>(storage: KeyValueStorage, key: string): T | null {
  try {
    const raw = storage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveJson(
  storage: KeyValueStorage,
  key: string,
  value: unknown,
): void {
  storage.setItem(PREFIX + key, JSON.stringify(value));
}

/** In-memory storage for tests and for browsers with storage disabled. */
export function memoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}
