// Node-only loader for the baked runtime assets. The browser build will load
// the same files by fetch; the engine core stays platform-free by taking
// plain word lists through buildDictionaries.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDictionaries, type Dictionaries } from './dictionary';

function readList(dir: string, name: string): string[] {
  return readFileSync(join(dir, name), 'utf8')
    .split('\n')
    .filter((w) => w.length > 0);
}

export function loadDictionaries(dir = 'public/data'): Dictionaries {
  return buildDictionaries({
    enable: readList(dir, 'enable.txt'),
    scowl95Extra: readList(dir, 'scowl95-extra.txt'),
    allow: readList(dir, 'patch-allow.txt'),
    deny: readList(dir, 'patch-deny.txt'),
    common: readList(dir, 'common-pool.txt'),
    source: readList(dir, 'source-pool.txt'),
  });
}
