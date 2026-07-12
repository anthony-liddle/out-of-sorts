// The worker's build routine, separated from the postMessage shell so the
// exact code the worker runs is unit-testable on the main thread. The
// breakdown timings answer the question that decides any further
// optimization: is the cost fetch, parse, or index build.
import {
  buildDictionaries,
  type Dictionaries,
  type WordLists,
} from '../engine/dictionary';
import { DATA_FILES, parseWordList, type DataTexts } from './build';

export interface BuildTimings {
  fetchMs: number;
  parseMs: number;
  buildMs: number;
}

export interface WorkerBuildResult {
  dicts: Dictionaries;
  timings: BuildTimings;
}

export async function runWorkerBuild(
  fetchText: (name: string) => Promise<string>,
): Promise<WorkerBuildResult> {
  const t0 = performance.now();
  const raw = await Promise.all(
    DATA_FILES.map(
      async ([key, name]) => [key, await fetchText(name)] as const,
    ),
  );
  const tFetched = performance.now();
  const texts = Object.fromEntries(raw) as unknown as DataTexts;

  const lists: WordLists = {
    enable: parseWordList(texts.enable),
    scowl95Extra: parseWordList(texts.scowl95Extra),
    allow: parseWordList(texts.allow),
    deny: parseWordList(texts.deny),
    common: parseWordList(texts.common),
    source: parseWordList(texts.source),
  };
  const tParsed = performance.now();

  const dicts = buildDictionaries(lists);
  const tBuilt = performance.now();

  return {
    dicts,
    timings: {
      fetchMs: tFetched - t0,
      parseMs: tParsed - tFetched,
      buildMs: tBuilt - tParsed,
    },
  };
}
