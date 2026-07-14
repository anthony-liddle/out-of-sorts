// Guards the F-Droid build flavour: after `vite build --mode fdroid`, no
// trace of the Vercel analytics SDK may exist anywhere in dist/. F-Droid
// forbids proprietary analytics dependencies outright, so the package must
// be ABSENT from the bundle, not disabled at runtime. Run via
// `pnpm run check:flavour`. The matching rules live in flavour-lib.ts and
// are pinned by test/flavour.test.ts.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { findAnalytics } from './flavour-lib';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

if (!existsSync('dist')) {
  console.error('no dist to check: run a build first');
  process.exit(1);
}

const offenders = findAnalytics(
  walk('dist').map((p) => ({ path: p, text: readFileSync(p, 'latin1') })),
);

if (offenders.length > 0) {
  console.error('F-Droid flavour is contaminated with analytics code:');
  for (const o of offenders) console.error(`  ${o.path}: ${o.hits.join(', ')}`);
  process.exit(1);
}
console.log('fdroid flavour clean: no analytics code in dist/');
