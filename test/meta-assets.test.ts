import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The game's face outside itself: favicon, PWA manifest, open graph.
// Everything self-hosted: this ships on F-Droid and no asset may come from
// an external origin.
describe('favicon, manifest, and open graph', () => {
  const html = readFileSync('index.html', 'utf8');

  it('ships the committed static assets', () => {
    for (const f of [
      'public/favicon.svg',
      'public/icons/icon-192.png',
      'public/icons/icon-512.png',
      'public/icons/apple-touch-icon.png',
      'public/og.png',
      'public/manifest.webmanifest',
    ]) {
      expect(existsSync(f), f).toBe(true);
    }
  });

  it('declares the full meta set', () => {
    for (const needle of [
      'og:title',
      'og:description',
      'og:image',
      'og:url',
      'twitter:card',
      'summary_large_image',
      'theme-color',
      'apple-touch-icon',
      'manifest',
      'gone forever',
    ]) {
      expect(html).toContain(needle);
    }
  });

  it('references no external origin for assets', () => {
    // og:url is the one legitimately absolute URL; everything loadable
    // (scripts, styles, icons, images) must be same origin.
    const withoutOgUrl = html
      .split('\n')
      .filter((l) => !l.includes('og:url'))
      .join('\n');
    expect(withoutOgUrl).not.toMatch(/(src|href)="https?:\/\//);
  });

  it('manifest icons point at the committed files', () => {
    const manifest = JSON.parse(
      readFileSync('public/manifest.webmanifest', 'utf8'),
    );
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    for (const icon of manifest.icons) {
      expect(icon.src.startsWith('/')).toBe(true);
      expect(existsSync(`public${icon.src}`)).toBe(true);
    }
    expect(manifest.theme_color.toLowerCase()).toBe('#f4f2fb');
  });
});
