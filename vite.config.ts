/// <reference types="vitest/config" />
import { appendFileSync } from 'node:fs';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Connect } from 'vite';

// Collects cold start timing reports POSTed by the instrumentation page,
// including from phones on the LAN. Dev and preview servers only; never
// part of the shipped app.
const reportMiddleware: Connect.NextHandleFunction = (req, res, next) => {
  if (req.url !== '/__cold-start-report' || req.method !== 'POST') {
    next();
    return;
  }
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    appendFileSync('cold-start-measurements.jsonl', body.trim() + '\n');
    res.statusCode = 204;
    res.end();
  });
};

// The fdroid mode is the F-Droid build flavour. It compiles __ANALYTICS__ to
// false so the @vercel/analytics import is dead code and never enters the
// bundle. F-Droid forbids proprietary analytics dependencies outright; the
// package must be absent, not disabled at runtime.
/**
 * The site origin, from one source. Absolute OG urls are required (scrapers
 * do not resolve a relative og:image), and hardcoding the origin twice is
 * how it rotted the first time.
 *
 * VERCEL_PROJECT_PRODUCTION_URL is the stable production host on Vercel, on
 * every environment including previews, so a preview build still advertises
 * a real, resolvable image. SITE_ORIGIN overrides it for anyone else.
 */
function siteOrigin(env: Record<string, string>): string {
  const explicit = env.SITE_ORIGIN ?? process.env.SITE_ORIGIN;
  if (explicit) return explicit.replace(/\/$/, '');
  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return 'https://out-of-sorts.vercel.app';
}

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src'),
    },
  },
  define: {
    __ANALYTICS__: JSON.stringify(mode !== 'fdroid'),
  },

  plugins: [
    react(),
    {
      // %SITE_ORIGIN% in index.html becomes the real origin at build time,
      // so og:url and og:image are absolute and always agree. One source,
      // resolved here, never hardcoded in the html.
      name: 'site-origin',
      transformIndexHtml(html) {
        return html.replaceAll('%SITE_ORIGIN%', siteOrigin({}));
      },
    },
    {
      name: 'cold-start-report',
      configureServer(server) {
        server.middlewares.use(reportMiddleware);
      },
      configurePreviewServer(server) {
        server.middlewares.use(reportMiddleware);
      },
    },
  ],
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    testTimeout: 120000,
  },
}));
