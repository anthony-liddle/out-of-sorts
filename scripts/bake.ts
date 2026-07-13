// Runs the offline data bake and writes runtime assets to public/data.
// Asserts the pinned counts; a different count means the cleaning drifted
// from what discovery measured against, and the build must stop.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildBakeOutputs, writeManifest } from './bake-lib';

const OUT = 'public/data';
// common is 61,411 length-filtered; discovery pinned 61,502 at the
// pre-filter stage. Both are recorded in CLAUDE.md.
const PINS = { boundary: 430172, common: 61411, source: 6526 };

const bake = buildBakeOutputs('data/raw');
const boundaryCount = bake.enable.length + bake.scowl95Extra.length;

if (
  boundaryCount !== PINS.boundary ||
  bake.common.length !== PINS.common ||
  bake.source.length !== PINS.source
) {
  console.error('Bake counts drifted from the discovery pins. Stopping.');
  console.error(`  boundary ${boundaryCount} (expected ${PINS.boundary})`);
  console.error(`  common ${bake.common.length} (expected ${PINS.common})`);
  console.error(`  source ${bake.source.length} (expected ${PINS.source})`);
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
const write = (name: string, words: string[]) =>
  writeFileSync(join(OUT, name), words.map((w) => w + '\n').join(''));

write('enable.txt', bake.enable);
write('scowl95-extra.txt', bake.scowl95Extra);
write('common-pool.txt', bake.common);
write('source-pool.txt', bake.source);
for (const patch of ['patch-allow.txt', 'patch-deny.txt']) {
  if (!existsSync(join(OUT, patch))) writeFileSync(join(OUT, patch), '');
}

const version = writeManifest(bake, OUT);

console.log(
  `boundary ${boundaryCount} (enable ${bake.enable.length} + extra ${bake.scowl95Extra.length})`,
);
console.log(`common ${bake.common.length}`);
console.log(`source ${bake.source.length}`);
console.log(`version ${version}`);
console.log(`baked to ${OUT}`);
