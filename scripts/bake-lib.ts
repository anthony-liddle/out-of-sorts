// Offline data bake. Reads the vendored raw lists in data/raw and produces
// the runtime word lists. No network, ever. The raw lists are classic SCOWL
// v1 (2020.12.07) plus ENABLE; see data/raw/README.md for provenance.
//
// Cleaning matches the discovery scripts exactly: read as ISO-8859-1,
// lowercase, keep only ^[a-z]+$. That drops possessives, hyphenations, and
// diacritics. SCOWL bands are cumulative: size N is the union of the english
// and american lists at every band <= N.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SCOWL_BANDS = [10, 20, 35, 40, 50, 55, 60, 70, 80, 95];
const WORD_RE = /^[a-z]+$/;

export interface BakeOutputs {
  /** Cleaned ENABLE, length >= 3. Half of the validation boundary. */
  enable: string[];
  /** SCOWL 95 words (length >= 3) that ENABLE lacks. The other half. */
  scowl95Extra: string[];
  /**
   * Cleaned SCOWL 50, all lengths: 61,502 words, the pinned discovery count.
   * The pin was measured before any length filter (the discovery solver
   * applied length >= 3 internally), so the baked file matches that stage
   * and the engine applies the minimum length when it builds indexes.
   */
  common: string[];
  /** SCOWL 35, length 8. The raw source pool, ungated. */
  source: string[];
}

function cleanFile(path: string): Set<string> {
  const out = new Set<string>();
  for (const line of readFileSync(path, 'latin1').split('\n')) {
    const w = line.trim().toLowerCase();
    if (WORD_RE.test(w)) out.add(w);
  }
  return out;
}

function scowlUpTo(rawDir: string, size: number): Set<string> {
  const words = new Set<string>();
  for (const band of SCOWL_BANDS) {
    if (band > size) continue;
    for (const prefix of ['english-words', 'american-words']) {
      for (const w of cleanFile(join(rawDir, 'scowl', `${prefix}.${band}`))) {
        words.add(w);
      }
    }
  }
  return words;
}

export function buildBakeOutputs(rawDir: string): BakeOutputs {
  const enableAll = cleanFile(join(rawDir, 'enable1.txt'));
  const scowl95 = scowlUpTo(rawDir, 95);
  const scowl50 = scowlUpTo(rawDir, 50);
  const scowl35 = scowlUpTo(rawDir, 35);

  const enable = [...enableAll].filter((w) => w.length >= 3).sort();
  const enableSet = new Set(enable);
  const scowl95Extra = [...scowl95]
    .filter((w) => w.length >= 3 && !enableSet.has(w))
    .sort();
  const common = [...scowl50].sort();
  const source = [...scowl35].filter((w) => w.length === 8).sort();

  return { enable, scowl95Extra, common, source };
}
