// Guards the F-Droid build flavour: after `vite build --mode fdroid`, no
// trace of the Vercel analytics package may exist anywhere in dist/. Run via
// `pnpm run check:flavour`. F-Droid forbids proprietary analytics
// dependencies outright, so the package must be absent from the bundle, not
// disabled at runtime.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const offenders = walk('dist').filter((p) =>
  readFileSync(p, 'latin1').toLowerCase().includes('vercel'),
);

if (offenders.length > 0) {
  console.error('F-Droid flavour is contaminated with analytics code:');
  for (const p of offenders) console.error(`  ${p}`);
  process.exit(1);
}
console.log('fdroid flavour clean: no analytics code in dist/');
