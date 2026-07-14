// The F-Droid analytics guard, as pure logic so it can be tested without
// running the CLI or needing a build on disk.
//
// It looks for ANALYTICS CODE, never for the string "vercel". The site is
// hosted on Vercel, so its own hostname legitimately appears in the open
// graph tags, and a hostname in a meta tag loads nothing and tracks nobody.
// Matching the bare word forced a choice between a correct link preview and
// a passing guard, and the guard lost. A safety check must not fail that
// way, so it got more precise rather than more lenient.

/** Signatures of the SDK itself: the import, the script host it injects,
 * the runtime global, and the endpoint it beacons to. */
export const ANALYTICS_SIGNATURES = [
  '@vercel/analytics',
  'vercel-scripts.com',
  '/_vercel/insights',
  'window.va',
  'va.track',
];

export interface ScannedFile {
  path: string;
  text: string;
}

export interface Contamination {
  path: string;
  hits: string[];
}

export function findAnalytics(files: readonly ScannedFile[]): Contamination[] {
  return files.flatMap((file) => {
    const text = file.text.toLowerCase();
    const hits = ANALYTICS_SIGNATURES.filter((sig) =>
      text.includes(sig.toLowerCase()),
    );
    return hits.length > 0 ? [{ path: file.path, hits }] : [];
  });
}
