// Real-browser layout assertions: jsdom has no layout engine, and the last
// build was fully tested in jsdom and still wrapped the rack 6 and 2 on a
// phone. Runs the app in a vite dev server and measures with chromium.
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let server: ViteDevServer;
let browser: Browser;
let page: Page;
let origin: string;

beforeAll(async () => {
  server = await createServer({ server: { port: 0 } });
  await server.listen();
  origin = server.resolvedUrls!.local[0]!;
  browser = await chromium.launch();
  page = await browser.newPage();
}, 60000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

async function freshGame(width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(origin);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('[data-ready="true"]');
}

async function tops(selector: string): Promise<number[]> {
  return page.$$eval(selector, (els) =>
    els.map((e) => Math.round(e.getBoundingClientRect().top)),
  );
}

describe('the rack never wraps', () => {
  for (const width of [320, 375, 390]) {
    it(`keeps eight tiles on one row at ${width}px`, async () => {
      await freshGame(width);
      const tileTops = await tops('[data-testid="pool-tile"]');
      expect(tileTops).toHaveLength(8);
      expect(new Set(tileTops).size, `tops: ${tileTops.join(',')}`).toBe(1);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow).toBe(false);
    });
  }
});

describe('the drift at phone width', () => {
  it('holds eight ghosts in at most two tidy rows at 375px', async () => {
    await freshGame(375);
    const input = page.locator('#word-input');
    // spend seven letters of the opening eight, then three of four:
    // SIDE drops four ghosts, DIE drops one, plus IDES and DIES holds
    for (const w of ['side', 'dies', 'ides', 'die']) {
      await input.fill(w);
      await input.press('Enter');
    }
    await page.waitForTimeout(900);
    const ghostTops = await tops('[data-testid="ghost"]');
    expect(ghostTops.length).toBe(5);
    expect(new Set(ghostTops).size).toBeLessThanOrEqual(2);
    const overflow = await page.evaluate(() => {
      const d = document.querySelector('[data-testid="drift"]')!;
      return d.scrollWidth > d.clientWidth;
    });
    expect(overflow).toBe(false);
  });
});

describe('the end screen comparison', () => {
  it('starts every stack at the same baseline and drops clean below on a phone', async () => {
    await freshGame(375);
    const input = page.locator('#word-input');
    await input.fill('side');
    await input.press('Enter');
    await page.getByRole('button', { name: 'Stop' }).click();
    await page.waitForSelector('[data-testid="end-screen"]');

    // phone: yours and best share a baseline, clean drops below the row
    const yourTop = (await tops('[data-testid="your-stack"] li'))[0]!;
    const bestTop = (await tops('[data-testid="par-stack"] li'))[0]!;
    expect(Math.abs(yourTop - bestTop)).toBeLessThanOrEqual(2);
    const cleanTop = (await tops('[data-testid="clean-stack"] li'))[0]!;
    expect(cleanTop).toBeGreaterThan(bestTop + 100);

    // desktop: all three share the baseline
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.waitForTimeout(200);
    const [y, b, c] = await Promise.all([
      tops('[data-testid="your-stack"] li'),
      tops('[data-testid="par-stack"] li'),
      tops('[data-testid="clean-stack"] li'),
    ]);
    expect(Math.abs(y[0]! - b[0]!)).toBeLessThanOrEqual(2);
    expect(Math.abs(b[0]! - c[0]!)).toBeLessThanOrEqual(2);
  }, 30000);
});
