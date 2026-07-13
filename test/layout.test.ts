// Real-browser layout assertions: jsdom has no layout engine, and an
// earlier build was fully tested in jsdom and still wrapped the rack 6 and
// 2 on a phone. Runs the app in a vite dev server and measures with
// chromium.
//
// Every test gets a fresh browser context, because local storage is per
// context and a test that finishes a run must never hand that ended run to
// the next test.
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

let server: ViteDevServer;
let browser: Browser;
let origin: string;
let page: Page;

beforeAll(async () => {
  server = await createServer({ server: { port: 0 } });
  await server.listen();
  origin = server.resolvedUrls!.local[0]!;
  browser = await chromium.launch();
}, 60000);

afterEach(async () => {
  await page?.context().close();
});

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

async function freshGame(width: number) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
  });
  page = await context.newPage();
  await page.goto(origin);
  await page.waitForSelector('[data-ready="true"]');
  await page.waitForSelector('#word-input');
}

async function play(word: string) {
  await page.locator('#word-input').fill(word);
  await page.locator('#word-input').press('Enter');
}

async function tops(selector: string): Promise<number[]> {
  return page.$$eval(selector, (els) =>
    els.map((e) => Math.round(e.getBoundingClientRect().top)),
  );
}

/** Width of the row for an exact word. Never a substring: ASIDES contains
 * SIDE, and measuring the wrong row makes a correct layout look broken. */
async function rowWidth(stack: string, word: string): Promise<number> {
  return page.$$eval(
    `[data-testid="${stack}"] [data-testid="stack-row"]`,
    (rows, target) => {
      const row = rows.find(
        (r) => r.querySelector('.stack-word')!.textContent!.trim() === target,
      );
      return row ? Math.round(row.getBoundingClientRect().width) : -1;
    },
    word,
  );
}

async function endedRun() {
  await freshGame(375);
  await play('side');
  await page.getByRole('button', { name: 'Stop' }).click();
  await page.waitForSelector('[data-testid="end-screen"]');
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

describe('cold start in a real browser', () => {
  it('paints an interactive rack well inside the budget', async () => {
    // The real number, measured where it means something: time from
    // navigation start to eight tiles on screen, with the dictionary still
    // loading in its worker. On device this is 0 to 2ms; the budget is
    // 100ms on a mid range phone, so a generous ceiling here still catches
    // a regression that puts the dictionary back on the critical path.
    const context = await browser.newContext({
      viewport: { width: 375, height: 900 },
    });
    page = await context.newPage();
    await page.goto(origin);
    await page.waitForSelector('[data-testid="pool-tile"]');
    const ms = await page.evaluate(() => {
      const tiles = performance.now();
      const nav = performance.getEntriesByType(
        'navigation',
      )[0] as PerformanceNavigationTiming;
      return tiles - nav.responseStart;
    });
    expect(ms).toBeLessThan(1000);
    const tiles = await page.$$('[data-testid="pool-tile"]');
    expect(tiles).toHaveLength(8);
    expect(await page.$('[role="progressbar"]')).toBeNull();
  }, 30000);
});

describe('the drift at phone width', () => {
  it('holds its ghosts in at most two tidy rows at 375px', async () => {
    await freshGame(375);
    for (const w of ['side', 'dies', 'ides', 'die']) await play(w);
    await page.waitForTimeout(900);
    const ghostTops = await tops('[data-testid="ghost"]');
    expect(ghostTops.length).toBe(5);
    expect(new Set(ghostTops).size).toBeLessThanOrEqual(2);
    const overflow = await page.evaluate(() => {
      const d = document.querySelector('[data-testid="drift"]')!;
      return d.scrollWidth > d.clientWidth;
    });
    expect(overflow).toBe(false);
  }, 30000);
});

describe('cold tiles at phone width', () => {
  it('keeps the tile silhouette: no ghost mask, uniform corners', async () => {
    // A ghost means the letter is gone; a cold tile means it is about to
    // be. The ghost silhouette is reserved for the drift, at every width.
    await freshGame(375);
    await page.locator('#word-input').fill('dis');
    await page.waitForTimeout(300);
    const cold = await page.$$eval(
      '[data-testid="pool-tile"][data-state="cold"]',
      (tiles) =>
        tiles.map((t) => {
          const cs = getComputedStyle(t);
          return {
            mask: cs.maskImage,
            radii: [
              cs.borderTopLeftRadius,
              cs.borderTopRightRadius,
              cs.borderBottomLeftRadius,
              cs.borderBottomRightRadius,
            ],
          };
        }),
    );
    expect(cold.length).toBeGreaterThan(0);
    for (const t of cold) {
      expect(t.mask).toBe('none');
      expect(new Set(t.radii).size).toBe(1);
    }
  }, 30000);
});

describe('one scale across every stack', () => {
  it('renders the same word at the same width in every column', async () => {
    // Width means word length. If a four letter word is a different width
    // in each column, the shapes cannot be compared, which is the entire
    // reason the columns exist.
    await endedRun();
    const yours = await rowWidth('your-stack', 'SIDE');
    const best = await rowWidth('par-stack', 'SIDE');
    const clean = await rowWidth('clean-stack', 'SIDE');
    expect(yours).toBeGreaterThan(0);
    expect(Math.abs(yours - best)).toBeLessThanOrEqual(1);
    expect(Math.abs(best - clean)).toBeLessThanOrEqual(1);

    // and the eight letter rows agree too, across the fold
    const bestEight = await rowWidth('par-stack', 'DISSUADE');
    const cleanEight = await rowWidth('clean-stack', 'DISSUADE');
    expect(Math.abs(bestEight - cleanEight)).toBeLessThanOrEqual(1);
    expect(bestEight).toBeGreaterThan(best);

    // desktop: same rule, three columns side by side
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.waitForTimeout(200);
    expect(
      Math.abs(
        (await rowWidth('par-stack', 'SIDE')) -
          (await rowWidth('clean-stack', 'SIDE')),
      ),
    ).toBeLessThanOrEqual(1);
  }, 30000);
});

describe('the end screen comparison', () => {
  it('starts every stack at the same baseline and drops clean below on a phone', async () => {
    await endedRun();
    const yourTop = (await tops('[data-testid="your-stack"] li'))[0]!;
    const bestTop = (await tops('[data-testid="par-stack"] li'))[0]!;
    expect(Math.abs(yourTop - bestTop)).toBeLessThanOrEqual(2);
    const cleanTop = (await tops('[data-testid="clean-stack"] li'))[0]!;
    expect(cleanTop).toBeGreaterThan(bestTop + 100);

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
