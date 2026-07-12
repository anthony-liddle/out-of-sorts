// Node-only loader for the baked runtime assets. Reuses the exact same
// text-to-index build as the browser paths so they cannot drift apart.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Dictionaries } from './dictionary';
import { buildFromTexts } from '../loader/build';

export function loadDictionaries(dir = 'public/data'): Dictionaries {
  const read = (name: string) => readFileSync(join(dir, name), 'utf8');
  return buildFromTexts({
    enable: read('enable.txt'),
    scowl95Extra: read('scowl95-extra.txt'),
    allow: read('patch-allow.txt'),
    deny: read('patch-deny.txt'),
    common: read('common-pool.txt'),
    source: read('source-pool.txt'),
  });
}
