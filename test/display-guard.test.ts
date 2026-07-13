import { describe, expect, it } from 'vitest';
import { scrambleRack } from '../src/engine/engine';
import { toSignature } from '../src/engine/signature';
import { realDicts } from './helpers/dicts';

// THE POOL DISPLAY MUST NEVER SPELL A VALID WORD. AT ANY SIZE. EVER.
// Below eight it is worse than at eight: a five letter pool that displays a
// valid five letter word gives away a hold on the rung where holds are
// densest.
describe('the pool display never spells a valid word', () => {
  const dicts = realDicts();
  const inBoundary = (d: string) => dicts.boundary.has(d);

  // Real pools at every size, drawn from real words so the letters are the
  // dangerous kind. Many seeds each: the shuffle hazard is on demand,
  // repeatedly.
  const pools = [
    'aet',
    'dei',
    'ops',
    'aps',
    'aest',
    'dies',
    'opst',
    'aers',
    'aeprs',
    'apswo',
    'aerst',
    'diess',
    'aeginr',
    'aeinrt',
    'opstuv',
    'aeginrt',
    'adeiprs',
    'aeginrst',
    'addeissu',
  ];

  it('holds for every pool size from 3 to 8, hammered across seeds', () => {
    for (const pool of pools) {
      for (let seed = 0; seed < 60; seed++) {
        const display = scrambleRack(pool, seed, inBoundary);
        expect(inBoundary(display), `${pool} seed ${seed} -> ${display}`).toBe(
          false,
        );
        expect(toSignature(display)).toBe(toSignature(pool));
      }
    }
  });

  it('terminates and finds the needle when only one arrangement is allowed', () => {
    // Every arrangement forbidden except one specific permutation: the
    // random pass will almost surely miss it, so the systematic fallback
    // must find it rather than loop or give up.
    const only = 'tea';
    const display = scrambleRack('aet', 1, (d) => d !== only);
    expect(display).toBe(only);
  });

  it('terminates even when every arrangement is forbidden', () => {
    const display = scrambleRack('aet', 1, () => true);
    expect(display).toHaveLength(3);
    expect(toSignature(display)).toBe('aet');
  });
});
