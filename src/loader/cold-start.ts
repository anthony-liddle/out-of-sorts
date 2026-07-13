// Cold start orchestration: try the cache, fall back to the worker build,
// never block the rack. The dictionaries promise is the only thing the game
// waits on, and only at first submit, through the submit gate.
import type { Dictionaries } from '../engine/dictionary';
import type { IndexCache } from './cache';
import type { BuildTimings, WorkerBuildResult } from './worker-build';

export interface ColdStartPorts {
  fetchManifest(): Promise<{ version: string }>;
  cache: IndexCache;
  buildInWorker(): Promise<WorkerBuildResult>;
}

export interface ColdStartTimings {
  source: 'cache' | 'worker';
  totalMs: number;
  manifestMs: number;
  cacheReadMs: number;
  build?: BuildTimings;
  cacheWriteMs?: number;
  cacheWriteError?: string;
}

export interface ColdStartResult {
  dictionaries: Promise<Dictionaries>;
  /** Resolves after the cache write settles; never blocks dictionaries. */
  timings: Promise<ColdStartTimings>;
}

export function coldStart(ports: ColdStartPorts): ColdStartResult {
  let resolveDicts!: (d: Dictionaries) => void;
  let rejectDicts!: (e: unknown) => void;
  const dictionaries = new Promise<Dictionaries>((resolve, reject) => {
    resolveDicts = resolve;
    rejectDicts = reject;
  });

  const timings = (async (): Promise<ColdStartTimings> => {
    const t0 = performance.now();
    const manifest = await ports.fetchManifest();
    const tManifest = performance.now();
    const cached = await ports.cache.get();
    const tCacheRead = performance.now();

    if (cached && cached.version === manifest.version) {
      resolveDicts(cached.dicts);
      return {
        source: 'cache',
        totalMs: tCacheRead - t0,
        manifestMs: tManifest - t0,
        cacheReadMs: tCacheRead - tManifest,
      };
    }

    if (cached) await ports.cache.clear();
    const built = await ports.buildInWorker();
    resolveDicts(built.dicts);
    const tReady = performance.now();

    let cacheWriteError: string | undefined;
    const tWrite0 = performance.now();
    try {
      await ports.cache.put(manifest.version, built.dicts);
    } catch (e) {
      cacheWriteError = e instanceof Error ? e.message : String(e);
    }
    return {
      source: 'worker',
      totalMs: tReady - t0,
      manifestMs: tManifest - t0,
      cacheReadMs: tCacheRead - tManifest,
      build: built.timings,
      cacheWriteMs: performance.now() - tWrite0,
      ...(cacheWriteError === undefined ? {} : { cacheWriteError }),
    };
  })();

  timings.catch((e) => rejectDicts(e));
  return { dictionaries, timings };
}
