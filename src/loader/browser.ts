// Browser wiring for cold start: real fetch, real IndexedDB, real worker.
// The orchestration logic itself lives in cold-start.ts and is unit-tested
// with fakes; this file only binds the ports to the platform.
import { openIndexCache } from './cache';
import { coldStart, type ColdStartResult } from './cold-start';
import type { WorkerBuildResult } from './worker-build';

export function startDictionaryLoad(baseUrl = '/data/'): ColdStartResult {
  return coldStart({
    async fetchManifest() {
      const res = await fetch(`${baseUrl}manifest.json`);
      if (!res.ok) throw new Error(`fetch manifest: ${res.status}`);
      return res.json();
    },
    cache: {
      // Defer opening the database until first use so a broken IndexedDB
      // (private browsing on some platforms) degrades to a worker build.
      async get() {
        try {
          return await (await openIndexCache()).get();
        } catch {
          return undefined;
        }
      },
      async put(version, dicts) {
        await (await openIndexCache()).put(version, dicts);
      },
      async clear() {
        await (await openIndexCache()).clear();
      },
    },
    buildInWorker() {
      return new Promise<WorkerBuildResult>((resolve, reject) => {
        const worker = new Worker(new URL('./worker.ts', import.meta.url), {
          type: 'module',
        });
        worker.onmessage = (event) => {
          worker.terminate();
          if (event.data.ok) {
            resolve({ dicts: event.data.dicts, timings: event.data.timings });
          } else {
            reject(new Error(event.data.error));
          }
        };
        worker.onerror = (event) => {
          worker.terminate();
          reject(new Error(event.message));
        };
        worker.postMessage({ baseUrl });
      });
    },
  });
}
