import { loadDictionaries } from '../../src/engine/load-node';
import type { Dictionaries } from '../../src/engine/dictionary';

let cached: Dictionaries | undefined;

export function realDicts(): Dictionaries {
  cached ??= loadDictionaries();
  return cached;
}
