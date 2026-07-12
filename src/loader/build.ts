// Pure text-to-index build, shared by every load path: the Web Worker, the
// main thread fallback, and the Node loader. One implementation means the
// worker and main thread cannot drift apart.
import { buildDictionaries, type Dictionaries } from '../engine/dictionary';

export interface DataTexts {
  enable: string;
  scowl95Extra: string;
  allow: string;
  deny: string;
  common: string;
  source: string;
}

/** Baked file names in fetch order, mapped to their DataTexts keys. */
export const DATA_FILES: ReadonlyArray<[keyof DataTexts, string]> = [
  ['enable', 'enable.txt'],
  ['scowl95Extra', 'scowl95-extra.txt'],
  ['allow', 'patch-allow.txt'],
  ['deny', 'patch-deny.txt'],
  ['common', 'common-pool.txt'],
  ['source', 'source-pool.txt'],
];

export function parseWordList(text: string): string[] {
  return text.split('\n').filter((w) => w.length > 0);
}

export function buildFromTexts(texts: DataTexts): Dictionaries {
  return buildDictionaries({
    enable: parseWordList(texts.enable),
    scowl95Extra: parseWordList(texts.scowl95Extra),
    allow: parseWordList(texts.allow),
    deny: parseWordList(texts.deny),
    common: parseWordList(texts.common),
    source: parseWordList(texts.source),
  });
}
