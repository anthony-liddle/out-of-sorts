import { describe, expect, it } from 'vitest';
import { LETTER_VALUES, wordScore } from '../src/engine/values';
import {
  removeSig,
  sigContains,
  subSignatures,
  toSignature,
} from '../src/engine/signature';
import { buildDictionaries } from '../src/engine/dictionary';
import { allowsPlay } from '../src/engine/rules';
import { scrambleRack } from '../src/engine/engine';

describe('letter values', () => {
  it('uses standard English Scrabble values', () => {
    expect(LETTER_VALUES['a']).toBe(1);
    expect(LETTER_VALUES['q']).toBe(10);
    expect(LETTER_VALUES['z']).toBe(10);
    expect(LETTER_VALUES['k']).toBe(5);
    expect(wordScore('sparrow')).toBe(12);
    expect(wordScore('quartz')).toBe(24);
  });
});

describe('signatures', () => {
  it('sorts letters into a signature', () => {
    expect(toSignature('sparrow')).toBe('aoprrsw');
  });

  it('checks multiset containment, respecting duplicates', () => {
    expect(sigContains('aoprrsw', 'aprsw')).toBe(true);
    expect(sigContains('aoprrsw', 'rr')).toBe(true);
    expect(sigContains('aoprsw', 'rr')).toBe(false);
    expect(sigContains('abc', 'abcd')).toBe(false);
  });

  it('computes the multiset difference for spent letters', () => {
    expect(removeSig('aoprrsw', 'aprsw')).toBe('or');
    expect(removeSig('aabb', 'ab')).toBe('ab');
    expect(removeSig('abc', 'abc')).toBe('');
  });

  it('enumerates unique sub-multisets at or above a minimum size', () => {
    const subs = subSignatures('aab', 2);
    expect(subs.sort()).toEqual(['aa', 'aab', 'ab'].sort());
    // 8 distinct letters: C(8,3..8) = 219
    expect(subSignatures('abcdefgh', 3)).toHaveLength(219);
  });
});

describe('dictionary building', () => {
  const dicts = buildDictionaries({
    enable: ['ate', 'eat', 'tares', 'zzzz'],
    scowl95Extra: ['tea'],
    allow: ['xylotomy'],
    deny: ['zzzz'],
    common: ['at', 'ate', 'eat', 'tares'],
    source: ['stannery'],
  });

  it('applies the patch layer: allow adds, deny removes', () => {
    expect(dicts.boundary.has('xylotomy')).toBe(true);
    expect(dicts.boundary.has('zzzz')).toBe(false);
    expect(dicts.boundary.has('ate')).toBe(true);
    expect(dicts.boundary.has('tea')).toBe(true);
  });

  it('drops words shorter than 3 from play dictionaries', () => {
    expect(dicts.commonIndex.has('at')).toBe(false);
    expect(dicts.commonIndex.get('aet')).toEqual(['ate', 'eat']);
  });

  it('indexes boundary words by signature', () => {
    expect(dicts.boundaryIndex.get('aet')).toEqual(['ate', 'eat', 'tea']);
    expect(dicts.boundaryIndex.get('aerst')).toEqual(['tares']);
  });

  it('keeps the source pool as given', () => {
    expect(dicts.source.has('stannery')).toBe(true);
  });
});

describe('endgame rule predicate', () => {
  it('mill allows holds at every pool size', () => {
    expect(allowsPlay('mill', 3, 3)).toBe(true);
    expect(allowsPlay('mill', 4, 4)).toBe(true);
    expect(allowsPlay('mill', 8, 8)).toBe(true);
  });

  it('terminal-three bans plays at a three letter pool', () => {
    expect(allowsPlay('terminal-three', 3, 3)).toBe(false);
    expect(allowsPlay('terminal-three', 4, 4)).toBe(true);
    expect(allowsPlay('terminal-three', 4, 3)).toBe(true);
  });

  it('descent bans holds at pools of four and three', () => {
    expect(allowsPlay('descent', 4, 4)).toBe(false);
    expect(allowsPlay('descent', 3, 3)).toBe(false);
    expect(allowsPlay('descent', 4, 3)).toBe(true);
    expect(allowsPlay('descent', 5, 5)).toBe(true);
    expect(allowsPlay('descent', 8, 8)).toBe(true);
  });
});

describe('rack scramble', () => {
  it('is deterministic per seed and never a forbidden arrangement', () => {
    const forbidden = new Set(['triangle', 'integral', 'relating']);
    const a = scrambleRack('triangle', 7, (d) => forbidden.has(d));
    const b = scrambleRack('triangle', 7, (d) => forbidden.has(d));
    expect(a).toBe(b);
    expect(forbidden.has(a)).toBe(false);
    expect([...a].sort().join('')).toBe('aegilnrt');
  });

  it('needs no dictionary, so the rack can render before the index exists', () => {
    const display = scrambleRack('sparrow', 1, (d) => d === 'sparrow');
    expect(display).not.toBe('sparrow');
    expect([...display].sort().join('')).toBe('aoprrsw');
  });
});
