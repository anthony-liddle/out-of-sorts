// Performance budget check. Puzzle creation, including the full solve, must
// complete in under 150 milliseconds on a mid-range phone. Desktop Node is
// roughly 4 to 6 times faster than a mid-range phone, so the working budget
// here is about 25 to 35 milliseconds per puzzle. Measure, then decide.
import { loadDictionaries } from '../src/engine/load-node';
import { createEngine } from '../src/engine/engine';

const t0 = performance.now();
const dicts = loadDictionaries();
const tLoad = performance.now() - t0;

const engine = createEngine(dicts);
const racks = [
  'triangle',
  'despairs',
  'sharpest',
  'operands',
  'tapestry',
  'restrain',
  'sunlight',
  'notebook',
  'quixotic',
  'buzzards',
];

// Warm run is the honest one for a long-lived app, but report cold too:
// the first puzzle pays the solver memo from scratch.
const cold0 = performance.now();
engine.createPuzzle(racks[0]!);
const cold = performance.now() - cold0;

const times: number[] = [];
for (const w of racks) {
  const t = performance.now();
  engine.createPuzzle(w);
  times.push(performance.now() - t);
}
times.sort((a, b) => a - b);

console.log(`dictionary load + index build (one time): ${tLoad.toFixed(0)}ms`);
console.log(`first puzzle (cold solver memo): ${cold.toFixed(1)}ms`);
console.log(
  `puzzle creation over ${racks.length} racks: ` +
    `median ${times[Math.floor(times.length / 2)]!.toFixed(1)}ms, ` +
    `max ${times[times.length - 1]!.toFixed(1)}ms`,
);
