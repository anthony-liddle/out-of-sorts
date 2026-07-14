// Generates the committed calendar artifact. A DELIBERATE, MANUAL ACTION:
// run via `pnpm run generate:calendar`, never as part of a normal build.
// Normal builds read public/data/calendar.json as committed.
//
// APPEND-ONLY, forever: once committed, entries are never reordered or
// removed. This script refuses to run if a calendar already exists, so a
// regeneration is an explicit, deliberate act (delete the artifact first
// and accept that the calendar epoch must be re-anchored).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { buildBakeOutputs, writeManifest } from './bake-lib';
import {
  applyDenylist,
  collapseToRacks,
  excludeSignatures,
  orderEntries,
  runStats,
} from './calendar-lib';
import { buildDictionaries } from '../src/engine/dictionary';
import { toSignature } from '../src/engine/signature';
import { Solver } from '../src/engine/solver';
import type { Calendar, CalendarEntry } from '../src/calendar/types';

const OUT = 'public/data/calendar.json';
// The calendar epoch: which date entry 0 falls on. MOVABLE (unlike
// STORAGE_EPOCH), but it must never be in the future: a future epoch makes
// rackForDate return null every day, and the first build shipped exactly
// that. Set it to the generation date.
const CALENDAR_EPOCH = '2026-07-12';
const ORDER_SEED = 20260801;

if (existsSync(OUT) && !process.argv.includes('--force')) {
  console.error(
    `${OUT} already exists. The calendar is append-only; regeneration ` +
      `re-dates every day and requires --force plus a re-anchored epoch.`,
  );
  process.exit(1);
}

const stage = (name: string, n: number) => console.log(`${name}: ${n}`);

// Denylist: the committed data/denylist.json plus anything already in the
// baked patch layer. The union goes back into patch-deny.txt so denied
// words are invalid everywhere, and into the manifest hash so caches roll.
const denyWords = new Set<string>([
  ...(
    JSON.parse(readFileSync('data/denylist.json', 'utf8')) as {
      words: string[];
    }
  ).words,
  ...readFileSync('public/data/patch-deny.txt', 'utf8')
    .split('\n')
    .filter((w) => w.length > 0),
]);
writeFileSync(
  'public/data/patch-deny.txt',
  [...denyWords]
    .sort()
    .map((w) => w + '\n')
    .join(''),
);
const bake = buildBakeOutputs('data/raw');
writeManifest(bake, 'public/data');
console.log(
  `denylist: ${denyWords.size} words into patch-deny, manifest refreshed`,
);

// Dictionaries with the deny applied, exactly as the runtime will load them.
const read = (name: string) =>
  readFileSync(`public/data/${name}`, 'utf8')
    .split('\n')
    .filter((w) => w.length > 0);
const dicts = buildDictionaries({
  enable: read('enable.txt'),
  scowl95Extra: read('scowl95-extra.txt'),
  allow: read('patch-allow.txt'),
  deny: [...denyWords],
  common: read('common-pool.txt'),
  source: read('source-pool.txt'),
});

// Stage 1 and 2: seeds to unique racks.
const seeds = [...dicts.source];
stage('seeds (scowl 35, length 8)', seeds.length);
const allRacks = collapseToRacks(seeds);
stage('unique racks after anagram collapse', allRacks.length);

// Stage 3: the gate, through the engine's solver, never reimplemented.
const solver = new Solver(dicts.commonIndex, 'mill');
const gated = allRacks.filter((r) => solver.solveRack(r).bestClean !== null);
stage('gate survivors (clean descent exists)', gated.length);
if (Math.abs(gated.length - 3300) > 50) {
  console.error(
    `Gate survivors ${gated.length} is materially different from ~3300. ` +
      `The gate or the dedupe drifted. Stopping.`,
  );
  process.exit(1);
}

// Stage 4: never share a rack with Peach.
const peach = JSON.parse(
  readFileSync('data/peach-exclusions.json', 'utf8'),
) as {
  words: string[];
};
const afterPeach = excludeSignatures(gated, peach.words);
stage('after peach exclusion', afterPeach.length);

// Stage 5: denylist. Eights lists come from the deny-applied boundary, so a
// rack whose only eights were denied now has an empty class and drops.
const {
  racks: afterDeny,
  denied,
  eightsFor,
} = applyDenylist(
  afterPeach,
  dicts.boundaryIndex as Map<string, readonly string[]>,
  denyWords,
);
stage('after denylist rack drops', afterDeny.length);
if (denied.length > 0) console.log(`  dropped racks: ${denied.join(', ')}`);

// Guard: a surviving rack must not be an anagram of any denied word, or the
// scramble could display a denied arrangement (it is absent from the baked
// eights list, so the forbidden predicate would not catch it).
const deniedSigs = new Set(
  [...denyWords].filter((w) => w.length === 8).map(toSignature),
);
const anagramDropped = afterDeny.filter((r) => deniedSigs.has(r));
const safeRacks = afterDeny.filter((r) => !deniedSigs.has(r));
stage('after denied-anagram guard', safeRacks.length);
if (anagramDropped.length > 0) {
  console.log(`  dropped denied-anagram racks: ${anagramDropped.join(', ')}`);
}

// Integrity check: the gate and par are computed from the common pool,
// which the deny does not touch (by design; the sweep reference was
// measured that way). If a denied word were ever load-bearing for a clean
// descent, that rack's promise would be unplayable. Quantify and drop any
// such rack now, before the first commit locks the calendar.
const commonMinusDeny = read('common-pool.txt').filter(
  (w) => !denyWords.has(w),
);
const strictDicts = buildDictionaries({
  enable: [],
  scowl95Extra: [],
  allow: [],
  deny: [],
  common: commonMinusDeny,
  source: [],
});
const strictSolver = new Solver(strictDicts.commonIndex, 'mill');
const gateFlips = safeRacks.filter(
  (r) => strictSolver.solveRack(r).bestClean === null,
);
const parShifts = safeRacks.filter(
  (r) => strictSolver.solveRack(r).par !== solver.solveRack(r).par,
);
const finalRacks = safeRacks.filter((r) => !gateFlips.includes(r));
stage('gate flips without denied words (dropped)', gateFlips.length);
if (gateFlips.length > 0) console.log(`  dropped: ${gateFlips.join(', ')}`);
console.log(
  `par relies on a denied word on ${parShifts.length} racks (kept, flagged in PR)`,
);
stage('final calendar entries', finalRacks.length);

// Stage 6: deterministic ordering. Multi-eight means two or more eights in
// the COMMON pool (the discoverable hold experience), matching discovery.
const entries: CalendarEntry[] = finalRacks.map((rack) => ({
  rack,
  eights: eightsFor(rack),
}));
const commonEights = (e: CalendarEntry) =>
  (dicts.commonIndex.get(e.rack)?.length ?? 0) >= 2;
const ordered = orderEntries(entries, ORDER_SEED, commonEights);

// Stage 7: write, then report the distribution.
const calendar: Calendar = { epoch: CALENDAR_EPOCH, entries: ordered };
writeFileSync(OUT, JSON.stringify(calendar, null, 1) + '\n');
console.log(`wrote ${OUT} (epoch ${CALENDAR_EPOCH})`);

const s = runStats(ordered, (e) => e.rack.includes('s'));
console.log(
  `longest S run: ${s.longestTrue}, longest non-S run: ${s.longestFalse}`,
);
const multiPos = ordered
  .map((e, i) => (commonEights(e) ? i : -1))
  .filter((i) => i >= 0);
const gaps = multiPos.slice(1).map((p, k) => p - multiPos[k]!);
gaps.sort((a, b) => a - b);
console.log(
  `multi-eight racks: ${multiPos.length}, spacing min/median/max: ` +
    `${gaps[0]}/${gaps[Math.floor(gaps.length / 2)]}/${gaps[gaps.length - 1]}`,
);
const eightsDist: Record<number, number> = {};
for (const e of ordered)
  eightsDist[e.eights.length] = (eightsDist[e.eights.length] ?? 0) + 1;
console.log(`boundary eights per entry: ${JSON.stringify(eightsDist)}`);
console.log(`years of dailies: ${(ordered.length / 365.25).toFixed(2)}`);
