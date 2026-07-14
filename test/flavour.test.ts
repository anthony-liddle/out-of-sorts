import { describe, expect, it } from 'vitest';
import { ANALYTICS_SIGNATURES, findAnalytics } from '../scripts/flavour-lib';

// F-Droid forbids proprietary analytics dependencies outright, so the
// package must be ABSENT from the bundle, not disabled at runtime. The
// guard looks for the SDK, never for the string "vercel": the site is
// hosted on Vercel, so its own hostname appears in the open graph tags, and
// a hostname in a meta tag loads nothing and tracks nobody. Matching the
// bare word forced a choice between a correct link preview and a passing
// guard, and the guard lost. That is the wrong way for a safety check to
// fail, so it got more precise rather than more lenient.
describe('the fdroid analytics guard', () => {
  it('catches the sdk import, the script host, and the beacon endpoint', () => {
    for (const signature of ANALYTICS_SIGNATURES) {
      expect(
        findAnalytics([{ path: 'x.js', text: `some code ${signature} more` }]),
      ).toHaveLength(1);
    }
  });

  it('catches the real injected runtime', () => {
    const bundled = 'function inject(){window.va=window.va||function(){}}';
    expect(findAnalytics([{ path: 'x.js', text: bundled }])).toHaveLength(1);
  });

  it('does not fire on the site hostname in a meta tag', () => {
    const head =
      '<meta property="og:image" content="https://out-of-sorts.vercel.app/og.png" />';
    expect(findAnalytics([{ path: 'index.html', text: head }])).toEqual([]);
  });
});
