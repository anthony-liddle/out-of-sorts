import { MIN_WORD_LENGTH } from './types';
import { toSignature } from './signature';

export interface WordLists {
  enable: readonly string[];
  scowl95Extra: readonly string[];
  allow: readonly string[];
  deny: readonly string[];
  common: readonly string[];
  source: readonly string[];
}

export type SigIndex = ReadonlyMap<string, readonly string[]>;

export interface Dictionaries {
  /** The validation boundary: ENABLE union SCOWL 95, patch layer applied. */
  boundary: ReadonlySet<string>;
  /** Boundary indexed by signature, minimum play length applied. */
  boundaryIndex: SigIndex;
  /** SCOWL 50 indexed by signature, minimum play length applied. This is
   * the par dictionary. Par is common pool only, never the boundary. */
  commonIndex: SigIndex;
  /** SCOWL 35 words of length 8, ungated. */
  source: ReadonlySet<string>;
}

function buildIndex(words: Iterable<string>): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const w of words) {
    if (w.length < MIN_WORD_LENGTH) continue;
    const sig = toSignature(w);
    const list = index.get(sig);
    if (list) list.push(w);
    else index.set(sig, [w]);
  }
  for (const list of index.values()) list.sort();
  return index;
}

export function buildDictionaries(lists: WordLists): Dictionaries {
  const boundary = new Set<string>();
  for (const w of lists.enable) boundary.add(w);
  for (const w of lists.scowl95Extra) boundary.add(w);
  for (const w of lists.allow) boundary.add(w);
  for (const w of lists.deny) boundary.delete(w);

  return {
    boundary,
    boundaryIndex: buildIndex(boundary),
    commonIndex: buildIndex(lists.common),
    source: new Set(lists.source),
  };
}
