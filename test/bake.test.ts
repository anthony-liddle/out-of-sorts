import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bakeVersion, buildBakeOutputs } from '../scripts/bake-lib';

// The three pinned counts. Discovery measured every design number against
// lists cleaned exactly this way. If any of these changes, the cleaning has
// drifted and every number in the GDD is untrustworthy. Do not adjust the
// expectations; find the drift.
const BOUNDARY_COUNT = 430172;
// 61,502 is the pre-filter cleaning stage every discovery statistic was
// measured against; 61,411 is what ships after dropping the 91 words of
// length one and two that can never be played.
const COMMON_COUNT = 61411;
const SOURCE_COUNT = 6526;

function loadBaked(name: string): string[] {
  return readFileSync(`public/data/${name}`, 'utf8')
    .split('\n')
    .filter((w) => w.length > 0);
}

describe('data bake', () => {
  const bake = buildBakeOutputs('data/raw');

  it('produces the pinned validation boundary count', () => {
    expect(bake.enable.length + bake.scowl95Extra.length).toBe(BOUNDARY_COUNT);
  });

  it('produces the pinned common pool count', () => {
    expect(bake.common.length).toBe(COMMON_COUNT);
  });

  it('produces the pinned raw source pool count', () => {
    expect(bake.source.length).toBe(SOURCE_COUNT);
  });

  it('keeps the enable and complement files disjoint', () => {
    const enable = new Set(bake.enable);
    expect(bake.scowl95Extra.some((w) => enable.has(w))).toBe(false);
  });

  it('cleans the way discovery did: lowercase a-z only, length 3 or more', () => {
    for (const list of [bake.enable, bake.scowl95Extra, bake.common]) {
      expect(list.every((w) => /^[a-z]{3,}$/.test(w))).toBe(true);
    }
    expect(bake.source.every((w) => /^[a-z]{8}$/.test(w))).toBe(true);
  });

  it('emits a manifest whose version hashes the baked artifacts', () => {
    const manifest = JSON.parse(
      readFileSync('public/data/manifest.json', 'utf8'),
    );
    expect(manifest.version).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.counts).toEqual({
      enable: bake.enable.length,
      scowl95Extra: bake.scowl95Extra.length,
      common: bake.common.length,
      source: bake.source.length,
    });
    expect(manifest.version).toBe(bakeVersion(bake));
  });

  it('matches the committed baked files exactly', () => {
    expect(loadBaked('enable.txt')).toEqual(bake.enable);
    expect(loadBaked('scowl95-extra.txt')).toEqual(bake.scowl95Extra);
    expect(loadBaked('common-pool.txt')).toEqual(bake.common);
    expect(loadBaked('source-pool.txt')).toEqual(bake.source);
  });

  it('ships empty but present patch layer files', () => {
    expect(loadBaked('patch-allow.txt')).toEqual([]);
    expect(loadBaked('patch-deny.txt')).toEqual([]);
  });
});
