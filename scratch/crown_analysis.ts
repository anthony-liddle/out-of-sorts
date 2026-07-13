// Discovery pass 4: the crown. Read-only investigation, scratch script.
// Uses the verified TypeScript engine; does not re-derive the solver.
//
// Heuristic inflection classifier (a sizing tool, not a rule): a source word
// is probably-inflected if it ends in -s, -es, -ed, -ing, -er, or -est AND a
// plausible stem is itself a word in the validation boundary. Stem candidates
// cover drop-suffix, restore-e, undouble-consonant, and -i back to -y forms.
// Known to misfire (INTEREST); the report hand-checks 50 flagged words.
import { writeFileSync } from 'node:fs'
import { loadDictionaries } from '../src/engine/load-node'
import { toSignature } from '../src/engine/signature'
import { Solver } from '../src/engine/solver'
import type { EndgameRule } from '../src/engine/types'

const dicts = loadDictionaries()
const boundary = dicts.boundary

function stemCandidates(w: string): string[] {
  const out: string[] = []
  const add = (s: string) => {
    if (s.length >= 3) out.push(s)
  }
  const undouble = (base: string) => {
    if (base.length >= 2 && base[base.length - 1] === base[base.length - 2])
      add(base.slice(0, -1))
  }
  if (w.endsWith('ies')) add(w.slice(0, -3) + 'y')
  if (w.endsWith('es')) add(w.slice(0, -2))
  if (w.endsWith('s') && !w.endsWith('ss')) add(w.slice(0, -1))
  if (w.endsWith('ied')) add(w.slice(0, -3) + 'y')
  if (w.endsWith('ed')) {
    add(w.slice(0, -2))
    add(w.slice(0, -1))
    undouble(w.slice(0, -2))
  }
  if (w.endsWith('ing')) {
    const base = w.slice(0, -3)
    add(base)
    add(base + 'e')
    undouble(base)
  }
  if (w.endsWith('ier')) add(w.slice(0, -3) + 'y')
  if (w.endsWith('er')) {
    add(w.slice(0, -2))
    add(w.slice(0, -1))
    undouble(w.slice(0, -2))
  }
  if (w.endsWith('iest')) add(w.slice(0, -4) + 'y')
  if (w.endsWith('est')) {
    add(w.slice(0, -3))
    add(w.slice(0, -2))
  }
  return out
}

const isInflected = (w: string): boolean =>
  stemCandidates(w).some((s) => boundary.has(s))

// Strict bracket: any candidate suffix at all, no stem check. The true lemma
// rule lands between the heuristic (lenient) and this (harshest ceiling).
const isStrictSuffix = (w: string): boolean =>
  ['s', 'es', 'ed', 'ing', 'er', 'est'].some((sfx) => w.endsWith(sfx))

// Source words and gate-surviving racks under mill.
const mill = new Solver(dicts.commonIndex, 'mill')
const racks = new Map<string, string[]>()
for (const w of dicts.source) {
  const sig = toSignature(w)
  const list = racks.get(sig)
  if (list) list.push(w)
  else racks.set(sig, [w])
}
const surviving = [...racks.keys()].filter(
  (sig) => mill.solveRack(sig).bestClean !== null,
)

// Per-rack mill profile from the par path. One sig per pool size along a
// path, so grouping played words by length reproduces the rung attribution
// of discovery pass 3.
interface Profile {
  plays: Record<number, number>
  points: Record<number, number>
  depth: number
  par: number
  clean: number
  fullClass: number
}
function profile(solver: Solver, sig: string): Profile {
  const s = solver.solveRack(sig)
  const plays: Record<number, number> = {}
  const points: Record<number, number> = {}
  for (const w of solver.parPath(sig)) {
    plays[w.length] = (plays[w.length] ?? 0) + 1
    points[w.length] =
      (points[w.length] ?? 0) +
      [...w].reduce(
        (a, c) => a + { a:1,b:3,c:3,d:2,e:1,f:4,g:2,h:4,i:1,j:8,k:5,l:1,m:3,n:1,o:1,p:3,q:10,r:1,s:1,t:1,u:1,v:4,w:4,x:8,y:4,z:10 }[c as 'a']!,
        0,
      )
  }
  return {
    plays,
    points,
    depth: s.maxDepth,
    par: s.par,
    clean: s.bestClean!,
    fullClass: dicts.commonIndex.get(sig)?.length ?? 0,
  }
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

function aggregate(sigs: string[], solver: Solver) {
  const plays: Record<number, number> = {}
  const points: Record<number, number> = {}
  const visits: Record<number, number> = {}
  const depths: number[] = []
  let fullHold = 0
  const classDist: Record<number, number> = {}
  for (const sig of sigs) {
    const p = profile(solver, sig)
    for (const [len, n] of Object.entries(p.plays)) {
      plays[+len] = (plays[+len] ?? 0) + n
      visits[+len] = (visits[+len] ?? 0) + 1
    }
    for (const [len, n] of Object.entries(p.points)) {
      points[+len] = (points[+len] ?? 0) + n
    }
    depths.push(p.depth)
    if (p.fullClass >= 2) fullHold++
    classDist[p.fullClass] = (classDist[p.fullClass] ?? 0) + 1
  }
  const tp = Object.values(plays).reduce((a, b) => a + b, 0)
  const ts = Object.values(points).reduce((a, b) => a + b, 0)
  const pct = (x: number, t: number) => Math.round((1000 * x) / t) / 10
  const rungs: Record<number, unknown> = {}
  for (const len of Object.keys(plays).map(Number).sort((a, b) => b - a)) {
    rungs[len] = {
      playsPct: pct(plays[len]!, tp),
      pointsPct: pct(points[len]!, ts),
      meanWords: Math.round((100 * plays[len]!) / visits[len]!) / 100,
    }
  }
  return {
    n: sigs.length,
    rungs,
    grindPlaysPct: pct((plays[3] ?? 0) + (plays[4] ?? 0), tp),
    grindPointsPct: pct((points[3] ?? 0) + (points[4] ?? 0), ts),
    rung5Mean:
      Math.round((100 * (plays[5] ?? 0)) / (visits[5] ?? 1)) / 100,
    medianDepth: median(depths),
    fullHoldPct: pct(fullHold, sigs.length),
    classDist,
  }
}

// Partitions.
const rackKept = (sig: string) =>
  racks.get(sig)!.some((w) => !isInflected(w))
const kept = surviving.filter(rackKept)
const removed = surviving.filter((sig) => !rackKept(sig))
const withS = surviving.filter((sig) => sig.includes('s'))
const withoutS = surviving.filter((sig) => !sig.includes('s'))

const out: Record<string, unknown> = {}
out.population = aggregate(surviving, mill)
out.kept = aggregate(kept, mill)
out.removed = aggregate(removed, mill)
out.withS = aggregate(withS, mill)
out.withoutS = aggregate(withoutS, mill)

// Q2: hold-rich racks lost vs rescued. Crown candidates are SOURCE words
// (SCOWL 35, length 8) of the rack; the full anagram class (common 50) is
// what the player can find. A rack survives if any crown candidate is
// heuristically clean.
const holdRich = surviving.filter(
  (sig) => (dicts.commonIndex.get(sig)?.length ?? 0) >= 2,
)
const lostHoldRacks = holdRich.filter((sig) => !rackKept(sig))
out.q2 = {
  holdRacks: holdRich.length,
  rescued: holdRich.length - lostHoldRacks.length,
  lost: lostHoldRacks.length,
  lostBigClasses: lostHoldRacks
    .filter((sig) => (dicts.commonIndex.get(sig)?.length ?? 0) >= 4)
    .map((sig) => ({
      rack: sig,
      classWords: dicts.commonIndex.get(sig),
      sourceWords: racks.get(sig),
    })),
  rescuedBigClasses: holdRich
    .filter(
      (sig) =>
        (dicts.commonIndex.get(sig)?.length ?? 0) >= 4 && rackKept(sig),
    )
    .map((sig) => ({
      rack: sig,
      crowns: racks.get(sig)!.filter((w) => !isInflected(w)),
      classWords: dicts.commonIndex.get(sig),
    })),
}

// Q4: endgame rules on the curated (kept) racks only.
const q4: Record<string, unknown> = {}
for (const rule of ['mill', 'terminal-three', 'descent'] as const) {
  const solver: Solver =
    rule === 'mill' ? mill : new Solver(dicts.commonIndex, rule)
  let teeth = 0
  let greedyHit = 0
  const pars: number[] = []
  const plays: Record<number, number> = {}
  const points: Record<number, number> = {}
  for (const sig of kept) {
    const p = profile(solver, sig)
    if (p.par !== p.clean) teeth++
    if (solver.greedy(sig).score === p.par) greedyHit++
    pars.push(p.par)
    for (const [len, n] of Object.entries(p.plays))
      plays[+len] = (plays[+len] ?? 0) + n
    for (const [len, n] of Object.entries(p.points))
      points[+len] = (points[+len] ?? 0) + n
  }
  const tp = Object.values(plays).reduce((a, b) => a + b, 0)
  const ts = Object.values(points).reduce((a, b) => a + b, 0)
  q4[rule] = {
    greedyParPct: Math.round((1000 * greedyHit) / kept.length) / 10,
    teethPct: Math.round((1000 * teeth) / kept.length) / 10,
    medianPar: median(pars),
    grindPlaysPct: Math.round((1000 * ((plays[3] ?? 0) + (plays[4] ?? 0))) / tp) / 10,
    grindPointsPct: Math.round((1000 * ((points[3] ?? 0) + (points[4] ?? 0))) / ts) / 10,
  }
}
out.q4 = q4

// Also: terminal-three greedy on the FULL population (the number the GDD
// says is still owed, independent of curation).
{
  const solver = new Solver(dicts.commonIndex, 'terminal-three')
  let hit = 0
  for (const sig of surviving) {
    if (solver.greedy(sig).score === solver.solveRack(sig).par) hit++
  }
  out.terminalThreeGreedyPopulationPct =
    Math.round((1000 * hit) / surviving.length) / 10
}

// Q5: pool sizing under the heuristic rule and the strict suffix bracket.
function sizePool(clean: (w: string) => boolean) {
  const words = [...dicts.source].filter(
    (w) => clean(w) && mill.solveRack(toSignature(w)).bestClean !== null,
  )
  const sigs = new Set(words.map(toSignature))
  return {
    words: words.length,
    racks: sigs.size,
    yearsOfDailies: Math.round((100 * words.length) / 365.25) / 100,
  }
}
out.q5 = {
  heuristic: sizePool((w) => !isInflected(w)),
  strictSuffix: sizePool((w) => !isStrictSuffix(w)),
  rawGate: sizePool(() => true),
}

// Step 0 evidence: classify the pass 3 top ten, and stride-sample 50 flagged
// source words for the hand check.
const topTen = ['despairs','reprisal','sharpest','panthers','patterns','operands','tapestry','caprices','compares','poachers']
out.topTenClassification = Object.fromEntries(
  topTen.map((w) => [w, isInflected(w) ? 'inflected' : 'clean']),
)
const flagged = [...dicts.source].filter(isInflected).sort()
const clean = [...dicts.source].filter((w) => !isInflected(w)).sort()
out.flaggedCounts = {
  flaggedWords: flagged.length,
  cleanWords: clean.length,
  flaggedPct: Math.round((1000 * flagged.length) / dicts.source.size) / 10,
}
const stride = Math.floor(flagged.length / 50)
out.handCheckSample = Array.from({ length: 50 }, (_, i) => flagged[i * stride]!)

writeFileSync('scratch/results_crown.json', JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))
