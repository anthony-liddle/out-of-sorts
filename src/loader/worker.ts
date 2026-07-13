// Web Worker entry: fetch the baked lists, build the index, post it back.
// The result crosses the thread boundary via structured clone, which
// handles the Maps and Sets in Dictionaries natively. All logic lives in
// runWorkerBuild so it is unit-tested; this file is only the shell.
import { runWorkerBuild } from './worker-build';

self.onmessage = async (event: MessageEvent<{ baseUrl: string }>) => {
  try {
    const result = await runWorkerBuild(async (name) => {
      const res = await fetch(`${event.data.baseUrl}${name}`);
      if (!res.ok) throw new Error(`fetch ${name}: ${res.status}`);
      return res.text();
    });
    self.postMessage({ ok: true, ...result });
  } catch (e) {
    self.postMessage({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
};
