// A signature is a word's letters sorted ascending. Two words are anagrams
// exactly when their signatures match, and a word is formable from a pool
// exactly when its signature is a sub-multiset of the pool signature.

export function toSignature(word: string): string {
  return [...word].sort().join('');
}

/** Multiset containment. Both arguments must be signatures (sorted). */
export function sigContains(pool: string, sub: string): boolean {
  let i = 0;
  for (const c of sub) {
    while (i < pool.length && pool[i]! < c) i++;
    if (i >= pool.length || pool[i] !== c) return false;
    i++;
  }
  return true;
}

/** Multiset difference pool minus sub. Both must be signatures. */
export function removeSig(pool: string, sub: string): string {
  let out = '';
  let i = 0;
  for (const c of pool) {
    if (i < sub.length && sub[i] === c) {
      i++;
    } else {
      out += c;
    }
  }
  return out;
}

/**
 * Every distinct sub-multiset of the pool with at least minLen letters,
 * including the pool itself. Pools are at most 8 letters, so bitmask
 * enumeration over 2^n subsets is cheap; duplicates collapse via a Set.
 */
export function subSignatures(pool: string, minLen: number): string[] {
  const n = pool.length;
  const seen = new Set<string>();
  for (let mask = 0; mask < 1 << n; mask++) {
    let sig = '';
    for (let bit = 0; bit < n; bit++) {
      if (mask & (1 << bit)) sig += pool[bit];
    }
    if (sig.length >= minLen) seen.add(sig);
  }
  return [...seen];
}
