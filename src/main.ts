// Cold start instrumentation harness. Renders the rack immediately with no
// dictionary, builds the index off the critical path, keeps the input live
// through the submit gate, and reports measured timings. This page is
// measurement scaffolding, not the game UI.
import { scrambleRack } from './engine/engine';
import { sigContains, toSignature } from './engine/signature';
import { openIndexCache } from './loader/cache';
import { startDictionaryLoad } from './loader/browser';
import { createSubmitGate } from './loader/submit-gate';
import { initAnalytics } from './analytics';

void initAnalytics();

const SOURCE_WORD = 'triangle';
const t0 = performance.now();

const rackEl = document.getElementById('rack')!;
const logEl = document.getElementById('log')!;
const wordEl = document.getElementById('word') as HTMLInputElement;
const log = (line: string) => {
  logEl.textContent += line + '\n';
};

// Step 2: the rack renders with no dictionary at all.
const rack = toSignature(SOURCE_WORD);
rackEl.textContent = scrambleRack(SOURCE_WORD, 1, (d) => d === SOURCE_WORD)
  .toUpperCase()
  .split('')
  .join(' ');
const rackInteractiveMs = performance.now() - t0;
log(`rack interactive: ${rackInteractiveMs.toFixed(1)}ms`);

// The index builds in parallel. The submit gate keeps input live meanwhile.
const load = startDictionaryLoad();
const gate = createSubmitGate(load.dictionaries, (dicts, word) => {
  const w = word.trim().toLowerCase();
  return (
    w.length >= 3 && dicts.boundary.has(w) && sigContains(rack, toSignature(w))
  );
});

document.getElementById('submit')!.onclick = async () => {
  const word = wordEl.value;
  const tSubmit = performance.now();
  const verdict = await gate.submit(word);
  const waited = performance.now() - tSubmit;
  log(
    `submit "${word}": ${verdict ? 'valid' : 'not valid'} (${waited.toFixed(1)}ms wait)`,
  );
};

document.getElementById('clear-cache')!.onclick = async () => {
  await (await openIndexCache()).clear();
  location.reload();
};

void load.timings.then(async (timings) => {
  const report = {
    userAgent: navigator.userAgent,
    hardwareConcurrency: navigator.hardwareConcurrency,
    rackInteractiveMs: Number(rackInteractiveMs.toFixed(1)),
    ...timings,
  };
  log(JSON.stringify(report, null, 2));
  try {
    await fetch('/__cold-start-report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(report),
    });
  } catch {
    // Report endpoint only exists on the dev and preview servers.
  }
});
