/**
 * The site origin, from one source. Absolute open graph urls are required
 * (no scraper resolves a relative og:image, which is why the link preview
 * had no image at all), and hardcoding the origin in two places is how it
 * rotted the first time.
 *
 * VERCEL_PROJECT_PRODUCTION_URL is the stable production host on Vercel in
 * every environment, including previews, so a preview build still advertises
 * a real, resolvable image. SITE_ORIGIN overrides it for anyone else.
 */
export function siteOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.SITE_ORIGIN;
  if (explicit) return explicit.replace(/\/$/, '');
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL ?? env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return 'https://out-of-sorts.vercel.app';
}

/** Resolves %SITE_ORIGIN% in the html. Used by the vite build and pinned
 * by the tests, so what ships is what is tested. */
export function resolveOrigin(html: string, origin = siteOrigin()): string {
  return html.replaceAll('%SITE_ORIGIN%', origin);
}
