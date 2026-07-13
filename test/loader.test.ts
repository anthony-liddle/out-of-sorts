import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { buildDictionaries } from '../src/engine/dictionary';
import { buildFromTexts, parseWordList } from '../src/loader/build';
import { runWorkerBuild } from '../src/loader/worker-build';
import { createSubmitGate } from '../src/loader/submit-gate';
import { openIndexCache } from '../src/loader/cache';
import {
  coldStart,
  DICTIONARY_FORMAT,
  type ColdStartPorts,
} from '../src/loader/cold-start';
import type { Dictionaries } from '../src/engine/dictionary';

const TEXTS = {
  enable: 'ate\neat\ntares\n',
  scowl95Extra: 'tea\n',
  allow: '',
  deny: '',
  common: 'ate\neat\ntares\n',
  source: 'stannery\n',
};

function synthDicts(): Dictionaries {
  return buildDictionaries({
    enable: ['ate', 'eat', 'tares'],
    scowl95Extra: ['tea'],
    allow: [],
    deny: [],
    common: ['ate', 'eat', 'tares'],
    source: ['stannery'],
  });
}

describe('building from raw texts', () => {
  it('parses word list text, dropping empty lines', () => {
    expect(parseWordList('ate\neat\n\ntea\n')).toEqual(['ate', 'eat', 'tea']);
  });

  it('builds identically to buildDictionaries on the same words', () => {
    expect(buildFromTexts(TEXTS)).toEqual(synthDicts());
  });

  it('builds identically through the worker path and the direct path', async () => {
    const fetchText = async (name: string) =>
      TEXTS[
        name
          .replace('.txt', '')
          .replace('scowl95-extra', 'scowl95Extra')
          .replace('patch-allow', 'allow')
          .replace('patch-deny', 'deny')
          .replace('common-pool', 'common')
          .replace('source-pool', 'source') as keyof typeof TEXTS
      ];
    const viaWorker = await runWorkerBuild(fetchText);
    expect(viaWorker.dicts).toEqual(buildFromTexts(TEXTS));
    expect(viaWorker.timings.fetchMs).toBeGreaterThanOrEqual(0);
    expect(viaWorker.timings.parseMs).toBeGreaterThanOrEqual(0);
    expect(viaWorker.timings.buildMs).toBeGreaterThanOrEqual(0);
  });
});

describe('submit gate', () => {
  it('queues submits made before the index is ready and never rejects them', async () => {
    let resolveReady!: (d: Dictionaries) => void;
    const ready = new Promise<Dictionaries>((r) => (resolveReady = r));
    const gate = createSubmitGate(ready, (dicts, word) =>
      dicts.boundary.has(word),
    );
    const early1 = gate.submit('tea');
    const early2 = gate.submit('zzz');
    let settled = false;
    void early1.then(() => (settled = true));
    await new Promise((r) => setTimeout(r, 10));
    expect(settled).toBe(false);
    resolveReady(synthDicts());
    await expect(early1).resolves.toBe(true);
    await expect(early2).resolves.toBe(false);
  });

  it('resolves queued submits in order', async () => {
    let resolveReady!: (d: Dictionaries) => void;
    const ready = new Promise<Dictionaries>((r) => (resolveReady = r));
    const order: string[] = [];
    const gate = createSubmitGate(ready, (_dicts, word) => {
      order.push(word);
      return word;
    });
    const a = gate.submit('first');
    const b = gate.submit('second');
    resolveReady(synthDicts());
    await Promise.all([a, b]);
    expect(order).toEqual(['first', 'second']);
  });

  it('resolves immediately once ready', async () => {
    const gate = createSubmitGate(Promise.resolve(synthDicts()), (d, w) =>
      d.boundary.has(w),
    );
    await expect(gate.submit('ate')).resolves.toBe(true);
  });
});

describe('index cache (IndexedDB)', () => {
  beforeEach(async () => {
    const cache = await openIndexCache();
    await cache.clear();
  });

  it('a cache hit returns an index identical to the fresh build', async () => {
    const cache = await openIndexCache();
    const fresh = buildFromTexts(TEXTS);
    await cache.put('v1', fresh);
    const cached = await cache.get();
    expect(cached?.version).toBe('v1');
    expect(cached?.dicts).toEqual(fresh);
  });

  it('returns undefined on a cold cache', async () => {
    const cache = await openIndexCache();
    expect(await cache.get()).toBeUndefined();
  });
});

describe('cold start orchestration', () => {
  function ports(overrides: Partial<ColdStartPorts> = {}): {
    ports: ColdStartPorts;
    calls: string[];
    store: { version: string; dicts: Dictionaries } | undefined;
  } {
    const calls: string[] = [];
    const state: {
      calls: string[];
      store: { version: string; dicts: Dictionaries } | undefined;
      ports: ColdStartPorts;
    } = {
      calls,
      store: undefined,
      ports: {
        fetchManifest: async () => {
          calls.push('manifest');
          return { version: 'v2' };
        },
        cache: {
          get: async () => {
            calls.push('cache.get');
            return state.store;
          },
          put: async (version, dicts) => {
            calls.push('cache.put');
            state.store = { version, dicts };
          },
          clear: async () => {
            calls.push('cache.clear');
            state.store = undefined;
          },
        },
        buildInWorker: async () => {
          calls.push('worker');
          return {
            dicts: synthDicts(),
            timings: { fetchMs: 1, parseMs: 1, buildMs: 1 },
          };
        },
        ...overrides,
      },
    };
    return state;
  }

  it('cache hit: resolves from cache and never spawns the worker', async () => {
    const p = ports();
    p.store = { version: `${DICTIONARY_FORMAT}:v2`, dicts: synthDicts() };
    const result = coldStart(p.ports);
    const dicts = await result.dictionaries;
    expect(dicts.boundary.has('tea')).toBe(true);
    const timings = await result.timings;
    expect(timings.source).toBe('cache');
    expect(p.calls).not.toContain('worker');
  });

  it('cache miss: builds in the worker and stores the result', async () => {
    const p = ports();
    const result = coldStart(p.ports);
    await result.dictionaries;
    const timings = await result.timings;
    expect(timings.source).toBe('worker');
    expect(p.calls).toContain('worker');
    expect(p.store?.version).toBe(`${DICTIONARY_FORMAT}:v2`);
  });

  it('a cache from an older build format is invalidated and rebuilt', async () => {
    // The dictionary BUILD can change semantics without any data file
    // changing (the uniform denylist did exactly that). The cache key
    // must carry a format number so old cached indexes die on upgrade.
    const p = ports();
    p.store = { version: 'v2', dicts: synthDicts() }; // bare data version, old format
    const result = coldStart(p.ports);
    await result.dictionaries;
    await result.timings;
    expect(p.calls).toContain('worker');
    expect(p.store?.version).toBe(`${DICTIONARY_FORMAT}:v2`);
  });

  it('a stale data version is invalidated and rebuilt', async () => {
    // The one that matters most. A stale index silently rejects valid
    // words, which looks like a dictionary bug and takes a day to find.
    const staleDicts = buildDictionaries({
      enable: ['old'],
      scowl95Extra: [],
      allow: [],
      deny: [],
      common: ['old'],
      source: [],
    });
    const p = ports();
    p.store = { version: 'v1-stale', dicts: staleDicts };
    const result = coldStart(p.ports);
    const dicts = await result.dictionaries;
    expect(dicts.boundary.has('tea')).toBe(true);
    expect(dicts.boundary.has('old')).toBe(false);
    await result.timings;
    expect(p.calls).toContain('worker');
    expect(p.store?.version).toBe(`${DICTIONARY_FORMAT}:v2`);
    expect(p.store?.dicts.boundary.has('tea')).toBe(true);
  });

  it('resolves dictionaries even if the cache write fails', async () => {
    const p = ports();
    p.ports.cache.put = async () => {
      throw new Error('quota exceeded');
    };
    const result = coldStart(p.ports);
    const dicts = await result.dictionaries;
    expect(dicts.boundary.has('tea')).toBe(true);
    const timings = await result.timings;
    expect(timings.cacheWriteError).toContain('quota');
  });
});
