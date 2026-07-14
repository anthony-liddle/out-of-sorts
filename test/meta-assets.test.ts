import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The game's face outside itself: favicon, PWA manifest, open graph.
// Everything self-hosted: this ships on F-Droid and no asset may come from
// an external origin.
describe('favicon, manifest, and open graph', () => {
  // These are look-at-it bugs, so the tests assert the things that were
  // actually broken and invisible: a relative og:image (which no scraper
  // resolves, so the link preview showed nothing anywhere), an og:url
  // pointing at the repo, a favicon set thin enough that browsers
  // downscaled a 192 into a 16px smudge, and a ghost that filled a third
  // of its own canvas. Committed-and-served was never the question.
  const html = readFileSync('index.html', 'utf8');
  const built = readFileSync('dist/index.html', 'utf8');

  it('ships the whole icon set', () => {
    for (const f of [
      'public/favicon.svg',
      'public/favicon.ico',
      'public/favicon-16.png',
      'public/favicon-32.png',
      'public/icons/apple-touch-icon.png',
      'public/icons/icon-192.png',
      'public/icons/icon-512.png',
      'public/og.png',
      'public/manifest.webmanifest',
    ]) {
      expect(existsSync(f), f).toBe(true);
    }
  });

  it('carries a real multi resolution ico holding 16 and 32', () => {
    const ico = readFileSync('public/favicon.ico');
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    const count = ico.readUInt16LE(4);
    expect(count).toBe(2);
    const sizes = Array.from({ length: count }, (_, i) =>
      ico.readUInt8(6 + i * 16),
    );
    expect(sizes.sort()).toEqual([16, 32]);
  });

  it('declares the svg first, the ico, and both small pngs', () => {
    const icons = [...html.matchAll(/<link rel="icon"[^>]*>/g)].map(
      (m) => m[0],
    );
    expect(icons[0]).toContain('favicon.svg');
    expect(icons.join(' ')).toContain('favicon.ico');
    expect(icons.join(' ')).toContain('favicon-16.png');
    expect(icons.join(' ')).toContain('favicon-32.png');
    expect(html).toContain('apple-touch-icon');
  });

  it('never declares the 192 as a page favicon: it is the manifest icon', () => {
    const icons = [...html.matchAll(/<link rel="icon"[^>]*>/g)].map(
      (m) => m[0],
    );
    expect(icons.join(' ')).not.toContain('icon-192');
    expect(icons.join(' ')).not.toContain('icon-512');
  });

  it('fills the frame: the ghost nearly touches the viewBox', () => {
    // A path inset by 15 units of 100 renders an 11px ghost at 16px, which
    // is the smudge. Fill it.
    const svg = readFileSync('public/favicon.svg', 'utf8');
    const d = /d="M([\d.]+) ([\d.]+)/.exec(svg)!;
    expect(Number(d[2])).toBeLessThanOrEqual(4);
    const coords = svg
      .split('d="')[1]!
      .split('"')[0]!
      .match(/-?\d+(\.\d+)?/g)!
      .map(Number);
    expect(Math.max(...coords)).toBeGreaterThanOrEqual(93);
    expect(Math.min(...coords.filter((n) => n >= 0))).toBeLessThanOrEqual(4);
  });

  it('stays legible on a dark tab', () => {
    const svg = readFileSync('public/favicon.svg', 'utf8');
    expect(svg).toContain('prefers-color-scheme: dark');
  });

  it('makes the open graph urls absolute at build time', () => {
    // A relative og:image is not resolved by iMessage, Slack, Twitter, or
    // Facebook: the preview simply has no image.
    expect(html).toContain('%SITE_ORIGIN%');
    expect(built).not.toContain('%SITE_ORIGIN%');
    const url = /property="og:url" content="([^"]+)"/.exec(built)![1]!;
    const image = /property="og:image" content="([^"]+)"/.exec(built)![1]!;
    expect(url).toMatch(/^https:\/\//);
    expect(image).toMatch(/^https:\/\/.+\/og\.png$/);
    expect(image.startsWith(new URL(url).origin)).toBe(true);
    expect(url).not.toContain('github.com');
  });

  it('declares the image dimensions and alt text scrapers want', () => {
    expect(html).toContain('og:image:width');
    expect(html).toContain('og:image:height');
    expect(html).toContain('og:image:alt');
    expect(html).toContain('summary_large_image');
    expect(html).toContain('theme-color');
  });

  it('loads no asset from an external origin', () => {
    const loadable = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(
      (m) => m[1]!,
    );
    for (const url of loadable) {
      expect(url.startsWith('http'), url).toBe(false);
    }
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
