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
import { readFileSync } from 'node:fs';
import { createEngine, type Engine } from '../src/engine/engine';
import { loadDictionaries } from '../src/engine/load-node';
import { rackForDate } from '../src/calendar/day';
import { dailyRunKey, storageDayIndex } from '../src/calendar/epochs';
import type { Calendar, CalendarEntry } from '../src/calendar/types';

/** The real committed calendar and the real engine. Built once: the index
 * takes a moment and every caller wants the same one. */
let engineCache: Engine | undefined;
function liveEngine(): Engine {
  engineCache ??= createEngine(loadDictionaries());
  return engineCache;
}

/** Today's actual daily, from the committed artifact. Never a synthetic
 * date: a synthetic date cannot see a bad epoch, which is how every daily
 * anyone ever saw was Day 1 for the life of the project. */
function todaysDaily(): { entry: CalendarEntry } {
  const calendar: Calendar = JSON.parse(
    readFileSync('public/data/calendar.json', 'utf8'),
  );
  const entry = rackForDate(calendar, new Date());
  if (!entry) throw new Error('no daily for today: the calendar epoch moved');
  return { entry };
}

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
  await page.waitForSelector('[data-testid="pool-tile"]');
}

/**
 * A fixed rack, in Endless, with the words to play on it. The daily rolls
 * over at midnight, so a test that hardcodes today's words breaks tomorrow:
 * that is the calendar epoch bug in miniature. Endless seed 1 is a pure
 * function of the committed calendar and never moves. PETUNIAS and PANTIES
 * both sit on the par path AND the clean path, so the same word can be
 * measured in all three end screen columns.
 */
const FIXED = {
  seed: 1,
  rack: 'aeinpstu',
  words: ['petunias', 'panties', 'paste', 'apes', 'pea'],
  onEveryPath: 'PETUNIAS',
};

async function fixedRack(width: number) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
  });
  page = await context.newPage();
  await page.addInitScript((fixed) => {
    localStorage.setItem(
      'oos:endless-current',
      JSON.stringify({
        rack: fixed.rack,
        words: [],
        stopped: false,
        endlessSeed: fixed.seed,
      }),
    );
  }, FIXED);
  await page.goto(origin);
  await page.waitForSelector('[data-ready="true"]');
  await page.getByRole('button', { name: 'Endless' }).click();
  await page.waitForSelector('[data-testid="pool-tile"]');
}

async function play(word: string) {
  // Type it, the way a player does: no field to focus, and no OS keyboard.
  await page.keyboard.press('Escape');
  for (const letter of word) await page.keyboard.press(letter);
  await page.keyboard.press('Enter');
}

async function tops(selector: string): Promise<number[]> {
  return page.$$eval(selector, (els) =>
    els.map((e) => Math.round(e.getBoundingClientRect().top)),
  );
}

/** Width of the row for an exact word. Never a substring: ASIDES contains
 * SIDE, and measuring the wrong row makes a correct layout look broken. */
async function rowWidth(stack: string, word: string): Promise<number> {
  // The pill, not the row: the row spans the column (pill plus score
  // gutter), and it is the pill that encodes word length.
  return page.$$eval(
    `[data-testid="${stack}"] [data-testid="stack-row"]`,
    (rows, target) => {
      const row = rows.find(
        (r) => r.querySelector('.stack-word')!.textContent!.trim() === target,
      );
      return row
        ? Math.round(
            row.querySelector('.stack-pill')!.getBoundingClientRect().width,
          )
        : -1;
    },
    word,
  );
}

async function endedRun() {
  await fixedRack(375);
  for (const w of FIXED.words.slice(0, 3)) await play(w);
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
    // A FRESH rack is never gated. It has nothing saved, so nothing about it
    // is unknowable, so it owes the dictionary no wait at all. The restore
    // line belongs to returning players and must never touch this path.
    expect(await page.$('[data-testid="restoring"]')).toBeNull();
    expect(await page.textContent('body')).not.toMatch(
      /finding what you left/i,
    );
  }, 30000);

  it('never paints a rack a returning mid-run player no longer owns', async () => {
    // The worse half of the flash, measured on the path where it actually
    // happens: a COLD LOAD of a restored daily, while the index is still
    // building in its worker. A mode switch cannot test this, because by
    // then the engine has already landed; a test written that way passes
    // with the bug still in place.
    //
    // Against the committed calendar and today's real rack, because anything
    // derived from a committed artifact must be tested against the committed
    // artifact. The words come from the engine's own par path, so this holds
    // on any day: take the opening eights (a hold keeps the pool at eight),
    // then the first word that actually drops a letter.
    const { entry } = todaysDaily();
    const puzzle = liveEngine().createPuzzle(entry.rack);
    const cut = puzzle.parPath.findIndex((w) => w.length < 8);
    const words = puzzle.parPath.slice(0, cut + 1);
    const restoredPool = words[words.length - 1]!.length;
    expect(restoredPool).toBeLessThan(8);

    const context = await browser.newContext({
      viewport: { width: 375, height: 900 },
    });
    page = await context.newPage();
    await page.addInitScript(
      (fixture) => {
        localStorage.setItem(
          `oos:${fixture.key}`,
          JSON.stringify({
            rack: fixture.rack,
            words: fixture.words,
            stopped: false,
          }),
        );
        // A frame is easy to miss by polling, so record the most tiles that
        // ever existed, from before the first paint.
        const w = window as unknown as { __maxTiles: number };
        w.__maxTiles = 0;
        new MutationObserver(() => {
          const n = document.querySelectorAll(
            '[data-testid="pool-tile"]',
          ).length;
          if (n > w.__maxTiles) w.__maxTiles = n;
        }).observe(document, { childList: true, subtree: true });
      },
      { key: dailyRunKey(new Date()), rack: entry.rack, words },
    );
    await page.goto(origin);
    await page.waitForSelector('[data-testid="stack-row"]');
    await page.waitForTimeout(300);

    const maxTiles = await page.evaluate(
      () => (window as unknown as { __maxTiles: number }).__maxTiles,
    );
    expect(maxTiles, 'the rack flashed before the restored pool').toBe(
      restoredPool,
    );
  }, 30000);
});

describe('the haunting', () => {
  // The margins are where the dead go. Ghosts scatter around the board,
  // deterministically, and never sit on the pool, the input, the controls,
  // or the stack. Five ghosts is a full run: the pool only ever shrinks,
  // so a rack of eight ending at three spends exactly five letters, and
  // FIXED.words spends all of them.
  const KEEP_OUT = [
    '[data-testid="pool"]',
    '[data-testid="word-display"]',
    '[data-testid="control-row"]',
    '[data-testid="stack"]',
    // the footer is furniture, not margin: the dead keep off the credits
    '.footer',
    // and the marque is a title page, not a haunt zone
    '.masthead',
  ];

  async function boxes(selector: string) {
    return page.$$eval(selector, (els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      }),
    );
  }

  type Box = { left: number; top: number; right: number; bottom: number };
  const intersects = (a: Box, b: Box) =>
    a.left < b.right &&
    b.left < a.right &&
    a.top < b.bottom &&
    b.top < a.bottom;

  async function fullHaunt(width: number) {
    await fixedRack(width);
    for (const w of FIXED.words) await play(w);
    // let the arrival and the aging glides settle before measuring
    await page.waitForTimeout(1600);
  }

  for (const width of [320, 375, 768, 1024, 1440]) {
    it(`scatters a full run around the board, never on it, at ${width}px`, async () => {
      await fullHaunt(width);
      const ghosts = await boxes('[data-testid="ghost"]');
      // one ghost per spent letter, exactly
      expect(ghosts.length).toBe(5);

      for (const selector of KEEP_OUT) {
        const parts = await boxes(selector);
        expect(parts.length).toBeGreaterThan(0);
        for (const part of parts) {
          for (const ghost of ghosts) {
            expect(
              intersects(ghost, part),
              `ghost at ${Math.round(ghost.left)},${Math.round(ghost.top)} sits on ${selector}`,
            ).toBe(false);
          }
        }
      }

      // a scatter, not a row: the dead do not share a baseline
      const ys = new Set(ghosts.map((g) => Math.round(g.top)));
      expect(ys.size).toBeGreaterThanOrEqual(3);

      // and nothing pushes the page wider than the phone
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow).toBe(false);
    }, 40000);
  }

  async function hauntSnapshot() {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    return page.$$eval('[data-testid="ghost"]', (els) =>
      els.map((e) => ({
        letter: e.textContent!.trim(),
        playIndex: (e as HTMLElement).dataset.playIndex,
        transform: (e as HTMLElement).style.transform,
        opacity: (e as HTMLElement).style.opacity,
      })),
    );
  }

  it('the same run haunts the same places after a reload', async () => {
    // Play the run live and carry its saved state into a fresh context:
    // fixedRack's init script re-seeds storage on every navigation, so a
    // plain reload would silently wipe the run instead of restoring it.
    await fullHaunt(375);
    const before = await hauntSnapshot();
    expect(before).toHaveLength(5);
    const saved = await page.evaluate(() =>
      localStorage.getItem('oos:endless-current'),
    );
    await page.context().close();

    const context = await browser.newContext({
      viewport: { width: 375, height: 900 },
    });
    page = await context.newPage();
    // Seed the storage before the app boots: the persist effect writes the
    // in-memory state out once the calendar lands, so a value set into a
    // page that has already booted gets clobbered by the fresh defaults.
    await page.addInitScript(
      (state) => localStorage.setItem('oos:endless-current', state!),
      saved,
    );
    await page.goto(origin);
    // the app boots into Daily; the endless run lives on its own tab
    await page.waitForSelector('[data-ready="true"]');
    await page.getByRole('button', { name: 'Endless' }).click();
    await page.waitForSelector('[data-testid="ghost"]');
    await page.waitForTimeout(700);
    const after = await hauntSnapshot();
    expect(after).toEqual(before);
  }, 40000);

  it('reduced motion stills every ghost at its aged place', async () => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 900 },
      reducedMotion: 'reduce',
    });
    page = await context.newPage();
    await page.addInitScript((fixed) => {
      localStorage.setItem(
        'oos:endless-current',
        JSON.stringify({
          rack: fixed.rack,
          words: [],
          stopped: false,
          endlessSeed: fixed.seed,
        }),
      );
    }, FIXED);
    await page.goto(origin);
    await page.waitForSelector('[data-ready="true"]');
    await page.getByRole('button', { name: 'Endless' }).click();
    await page.waitForSelector('[data-testid="pool-tile"]');
    for (const w of FIXED.words) await play(w);
    await page.waitForTimeout(400);

    // every ghost visible, positioned, at its aged opacity
    const spirits = await page.$$eval('[data-testid="ghost"]', (els) =>
      els.map((e) => {
        const cs = getComputedStyle(e);
        const wander = e.querySelector('.ghost-wander')!;
        const bob = e.querySelector('.ghost-bob')!;
        return {
          playIndex: Number((e as HTMLElement).dataset.playIndex),
          opacity: Number(cs.opacity),
          animations: [
            cs.animationName,
            getComputedStyle(wander).animationName,
            getComputedStyle(bob).animationName,
            getComputedStyle(bob, '::before').animationName,
          ],
          transition: cs.transitionDuration,
        };
      }),
    );
    expect(spirits).toHaveLength(5);
    for (const s of spirits) {
      for (const name of s.animations) expect(name).toBe('none');
      expect(s.transition.split(',').every((d) => d.trim() === '0s')).toBe(
        true,
      );
      expect(s.opacity).toBeGreaterThan(0.1);
    }
    // older is fainter, always: age survives stillness
    const byPlay = new Map<number, number>();
    for (const s of spirits) byPlay.set(s.playIndex, s.opacity);
    const plays = [...byPlay.keys()].sort((a, b) => a - b);
    for (let i = 1; i < plays.length; i++) {
      expect(byPlay.get(plays[i]!)!).toBeGreaterThan(
        byPlay.get(plays[i - 1]!)!,
      );
    }

    // and nothing moves: the haunt holds perfectly still
    const at = async () =>
      page.$$eval('[data-testid="ghost"] .ghost-body', (els) =>
        els.map((e) => {
          const r = e.getBoundingClientRect();
          return `${r.left.toFixed(1)},${r.top.toFixed(1)}`;
        }),
      );
    const first = await at();
    await page.waitForTimeout(600);
    expect(await at()).toEqual(first);
  }, 40000);

  it('places twins side by side: the I and N of one drop hang together', async () => {
    await fullHaunt(375);
    const twins = await page.$$eval(
      '[data-testid="ghost"][data-play-index="2"]',
      (els) =>
        els.map((e) => {
          const r = e.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }),
    );
    expect(twins).toHaveLength(2);
    const gap = Math.hypot(
      twins[0]!.x - twins[1]!.x,
      twins[0]!.y - twins[1]!.y,
    );
    expect(gap).toBeLessThanOrEqual(60);
  }, 40000);
});

describe('the trim', () => {
  it('lifts the tiles on a violet under shadow and grains the ground', async () => {
    await fixedRack(375);
    // tiles are objects being lifted, not divs: the under shadow is the
    // violet of the game, not a grey
    const shadow = await page.$eval(
      '[data-testid="pool-tile"]',
      (el) => getComputedStyle(el).boxShadow,
    );
    expect(shadow).toContain('rgba(127, 119, 221');
    // the ground carries a whisper of grain, inline and self contained
    const ground = await page.evaluate(
      () => getComputedStyle(document.body).backgroundImage,
    );
    expect(ground).toContain('data:image/svg+xml');
    // and the marque sits above the title, a third register
    const marqueTop = await page.$eval(
      '[data-testid="marque"]',
      (el) => el.getBoundingClientRect().top,
    );
    const titleTop = await page.$eval(
      '.masthead h1',
      (el) => el.getBoundingClientRect().top,
    );
    expect(marqueTop).toBeLessThan(titleTop);
  }, 30000);
});

describe('the marque', () => {
  // A title page, not a toolbar: the masthead centers with the board at
  // every width, the subtitle carries visible flanking rules, and a
  // hairline separates the title zone from the play zone.
  for (const width of [320, 375, 768, 1440]) {
    it(`centers the masthead at ${width}px`, async () => {
      await fixedRack(width);
      const centers = await page.evaluate(() => {
        const mid = (r: DOMRect) => r.left + r.width / 2;
        const brand = document.querySelector('.brand')!.getBoundingClientRect();
        const title = document
          .querySelector('.masthead h1')!
          .getBoundingClientRect();
        const header = document
          .querySelector('.masthead')!
          .getBoundingClientRect();
        return {
          brand: mid(brand),
          title: mid(title),
          header: mid(header),
          brandWidth: brand.width,
          headerWidth: header.width,
          viewport: window.innerWidth / 2,
        };
      });
      // centered as a block: the brand hugs its text and sits mid page
      expect(centers.brandWidth).toBeLessThan(centers.headerWidth - 20);
      expect(Math.abs(centers.brand - centers.viewport)).toBeLessThanOrEqual(2);
      expect(Math.abs(centers.title - centers.viewport)).toBeLessThanOrEqual(2);

      // the eyebrow holds one line even at the narrowest phone: a wrapped
      // eyebrow reads as a paragraph, not a marque
      const marque = await page.$eval('[data-testid="marque"]', (el) => {
        const cs = getComputedStyle(el);
        return {
          height: el.getBoundingClientRect().height,
          lineHeight:
            parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.6,
        };
      });
      expect(marque.height).toBeLessThan(marque.lineHeight * 1.5);
    }, 30000);
  }

  it('flanks the subtitle with rules and closes the title zone with one', async () => {
    await fixedRack(375);
    const subtitle = await page.$eval('[data-testid="subtitle"]', (el) => {
      const before = getComputedStyle(el, '::before');
      const after = getComputedStyle(el, '::after');
      return {
        before: parseFloat(before.width),
        after: parseFloat(after.width),
      };
    });
    expect(subtitle.before).toBeGreaterThan(8);
    expect(subtitle.after).toBeGreaterThan(8);
    const divider = await page.$eval(
      '[data-testid="masthead-divider"]',
      (el) => {
        const r = el.getBoundingClientRect();
        const masthead = el.closest('.masthead')!.getBoundingClientRect();
        return { width: r.width, headerWidth: masthead.width };
      },
    );
    // the hairline spans the title block
    expect(divider.width).toBeGreaterThan(divider.headerWidth * 0.9);
  }, 30000);
});

describe('the stack is a monument', () => {
  // A landing (a mined anagram class) fuses into one tier: tighter gap,
  // flattened adjoining corners. A notch stays a gap and nothing else; no
  // accent color may mark it, and width stays a pure function of length
  // (pinned by 'the pill is only ever length' below).
  async function rowByWord(word: string) {
    return page.$$eval(
      '[data-testid="stack"] [data-testid="stack-row"]',
      (rows, target) => {
        const row = rows.find(
          (r) => r.querySelector('.stack-word')!.textContent!.trim() === target,
        )!;
        const pill = row.querySelector('.stack-pill')!;
        const cs = getComputedStyle(pill);
        const box = row.getBoundingClientRect();
        return {
          top: box.top,
          bottom: box.bottom,
          background: cs.backgroundColor,
          radii: {
            topLeft: parseFloat(cs.borderTopLeftRadius),
            bottomLeft: parseFloat(cs.borderBottomLeftRadius),
          },
        };
      },
      word,
    );
  }

  it('fuses a landing into one tier and leaves the notch a plain gap', async () => {
    await fixedRack(375);
    // PASTE lands as a notch (two letters dropped); APES then PEAS is a
    // landing, the mined pair of the four letter class.
    for (const w of ['petunias', 'panties', 'paste', 'apes', 'peas']) {
      await play(w);
    }
    const petunias = await rowByWord('PETUNIAS');
    const panties = await rowByWord('PANTIES');
    const paste = await rowByWord('PASTE');
    const apes = await rowByWord('APES');
    const peas = await rowByWord('PEAS');

    // the landing pair sits tighter than the default rhythm, and far
    // tighter than the notch gap
    const defaultGap = panties.top - petunias.bottom;
    const notchGap = paste.top - panties.bottom;
    const landingGap = peas.top - apes.bottom;
    expect(landingGap).toBeLessThan(defaultGap);
    expect(notchGap).toBeGreaterThan(defaultGap);

    // the tier fuses by shape: adjoining corners flatten, outer corners stay
    expect(apes.radii.bottomLeft).toBeLessThan(apes.radii.topLeft);
    expect(peas.radii.topLeft).toBeLessThan(peas.radii.bottomLeft);
    // rows outside a landing keep uniform corners
    expect(panties.radii.topLeft).toBe(panties.radii.bottomLeft);

    // the notch carries no accent: same fill as any plain row
    expect(paste.background).toBe(panties.background);
    expect(apes.background).toBe(paste.background);
  }, 40000);
});

describe('a page, not a strip', () => {
  // The desktop was a phone layout stretched. On wide viewports the stack
  // moves beside the board, where the run's shape can be read at full
  // height; below the breakpoint the single column that already works is
  // byte for byte the same DOM, laid out as before.
  async function box(selector: string) {
    return page.$eval(selector, (e) => {
      const r = e.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    });
  }

  it('renders the stack beside the board at 1440px', async () => {
    await fixedRack(1440);
    for (const w of FIXED.words.slice(0, 3)) await play(w);
    const stack = await box('[data-testid="stack"]');
    const controls = await box('[data-testid="control-row"]');
    const pool = await box('[data-testid="pool"]');
    // beside, not below: the stack starts right of the board column and
    // overlaps it vertically
    expect(stack.left).toBeGreaterThan(controls.right);
    expect(stack.top).toBeLessThan(controls.bottom);
    // and the board column still holds together
    expect(pool.right).toBeLessThanOrEqual(controls.right + 2);
  }, 40000);

  for (const width of [375, 768]) {
    it(`keeps the single column at ${width}px: stack below the controls`, async () => {
      await fixedRack(width);
      for (const w of FIXED.words.slice(0, 3)) await play(w);
      const stack = await box('[data-testid="stack"]');
      const controls = await box('[data-testid="control-row"]');
      expect(stack.top).toBeGreaterThanOrEqual(controls.bottom);
      // centered in the same column as the board
      const stackMid = (stack.left + stack.right) / 2;
      const controlsMid = (controls.left + controls.right) / 2;
      expect(Math.abs(stackMid - controlsMid)).toBeLessThanOrEqual(2);
    }, 40000);
  }
});

describe('the empty table', () => {
  // The two column desktop layout was designed for a run in progress and
  // fell apart before the first word: the board centered on its COLUMN
  // while the masthead centered on the PAGE, and the two disagreed by half
  // a stack column. The board and the masthead share one center line, in
  // every layout, at every width, with a stack or without one.
  async function centers() {
    return page.evaluate(() => {
      const mid = (sel: string) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return r.left + r.width / 2;
      };
      return {
        title: mid('.masthead h1')!,
        pool: mid('[data-testid="pool"]')!,
        controls: mid('[data-testid="control-row"]')!,
      };
    });
  }

  for (const width of [320, 375, 768, 1024, 1440]) {
    it(`board and masthead share a center on a fresh rack at ${width}px`, async () => {
      await fixedRack(width);
      const c = await centers();
      expect(
        Math.abs(c.pool - c.title),
        `pool off by ${c.pool - c.title}`,
      ).toBeLessThanOrEqual(2);
      expect(
        Math.abs(c.controls - c.title),
        `controls off by ${c.controls - c.title}`,
      ).toBeLessThanOrEqual(2);
    }, 40000);

    it(`and keeps it with a full stack at ${width}px`, async () => {
      await fixedRack(width);
      for (const w of FIXED.words.slice(0, 3)) await play(w);
      const c = await centers();
      expect(Math.abs(c.pool - c.title)).toBeLessThanOrEqual(2);
      expect(Math.abs(c.controls - c.title)).toBeLessThanOrEqual(2);
    }, 40000);
  }

  it('the board does not move when the first word lands', async () => {
    // The empty column is reserved, not collapsed: a board that jumps
    // sideways on the first Spend is worse than a quiet empty column.
    await fixedRack(1440);
    const before = (await centers()).pool;
    await play(FIXED.words[0]!);
    const after = (await centers()).pool;
    expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
  }, 40000);

  it('reserves the empty column in voice on a wide fresh rack', async () => {
    await fixedRack(1440);
    const line = await page.$eval('[data-testid="stack-waiting"]', (el) => ({
      text: el.textContent!.trim(),
      display: getComputedStyle(el).display,
    }));
    expect(line.text).toBe('Nothing spent yet.');
    expect(line.display).not.toBe('none');
  }, 40000);

  it('reserves the phone stack in voice too, below Stop', async () => {
    // This line used to be desktop only, on the reasoning that a second
    // empty line under the drift is clutter. That was about a line stacked
    // at the TOP. On a phone the stack column does not exist, so its space
    // opens up BELOW Stop as a field of dead lilac, and the space has to
    // stay reserved or the board jumps when the first word lands. Reserved
    // space wants a voice, and it is the stack's space, so it says what the
    // desktop column says.
    await fixedRack(375);
    const line = await page.$eval('[data-testid="stack-waiting"]', (el) => {
      const r = el.getBoundingClientRect();
      return {
        text: el.textContent!.trim(),
        display: getComputedStyle(el).display,
        top: r.top,
      };
    });
    expect(line.text).toBe('Nothing spent yet.');
    expect(line.display).not.toBe('none');

    const stop = await page.$eval(
      '.stop-button',
      (e) => e.getBoundingClientRect().bottom,
    );
    expect(line.top).toBeGreaterThan(stop);
  }, 40000);

  it('does not move the phone board when the first word lands', async () => {
    // The whole reason the space stays reserved. A board that slides up
    // under the thumb on the first Spend is worse than a field of lilac.
    await fixedRack(375);
    const poolTop = () =>
      page.$eval('[data-testid="pool"]', (e) =>
        Math.round(e.getBoundingClientRect().top),
      );
    const before = await poolTop();
    await play(FIXED.words[0]!);
    await page.waitForSelector('[data-testid="stack-row"]');
    expect(Math.abs((await poolTop()) - before)).toBeLessThanOrEqual(1);
  }, 40000);

  it('stop sits under the board, never alone in an empty region', async () => {
    await fixedRack(1440);
    const stop = await page.$eval('.stop-button', (e) => {
      const r = e.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top };
    });
    const controls = await page.$eval('[data-testid="control-row"]', (e) => {
      const r = e.getBoundingClientRect();
      return { left: r.left, right: r.right, bottom: r.bottom };
    });
    // under the controls, on the board's center line, with air below Spend
    expect(stop.top).toBeGreaterThanOrEqual(controls.bottom + 16);
    const stopMid = (stop.left + stop.right) / 2;
    const controlsMid = (controls.left + controls.right) / 2;
    expect(Math.abs(stopMid - controlsMid)).toBeLessThanOrEqual(2);
  }, 40000);

  it('the footer meets the bottom of a short page', async () => {
    // No dead field of lilac: on a page shorter than the viewport the
    // footer sits at the bottom of the window, not the bottom of the text.
    await fixedRack(1440);
    const gap = await page.evaluate(() => {
      const footer = document.querySelector('.footer')!.getBoundingClientRect();
      return window.innerHeight - footer.bottom;
    });
    expect(gap).toBeLessThanOrEqual(80);
  }, 40000);
});

describe('the word display holds its size', () => {
  it('is exactly the same height empty and full', async () => {
    // The board must not jump under the player's thumb as they type. The
    // display had a min-height, but the display font's line box plus
    // padding outgrew it the moment a letter appeared.
    await fixedRack(375);
    const height = () =>
      page.$eval(
        '[data-testid="word-display"]',
        (el) => Math.round(el.getBoundingClientRect().height * 10) / 10,
      );
    const empty = await height();
    for (const letter of 'petunias') {
      await page.keyboard.press(letter);
      expect(await height()).toBe(empty);
    }
    await page.keyboard.press('Escape');
    expect(await height()).toBe(empty);
  }, 30000);
});

describe('cold is at risk, not disabled', () => {
  // This regression has come back twice. The cause was never the number of
  // signals: it was that every signal was SUBTRACTIVE. Pale fill, gray
  // letter, sunk position is the universal vocabulary of a disabled
  // control, so the board only ever offered two readings, enabled and
  // disabled, and there was no third one available. At risk must be marked
  // by ADDITION. The outline carries the status; everything else is held
  // constant, and this test pins that hard.
  async function snapshot() {
    return page.$$eval('[data-testid="pool-tile"]', (tiles) =>
      tiles.map((t) => {
        const cs = getComputedStyle(t);
        // The status rings are pseudo elements that cross fade: a border
        // cannot transition its own pattern without flickering.
        const mint = getComputedStyle(t, '::before');
        const ghost = getComputedStyle(t, '::after');
        return {
          state: (t as HTMLElement).dataset.state ?? 'available',
          background: cs.backgroundColor,
          color: cs.color,
          transform: cs.transform,
          top: Math.round(t.getBoundingClientRect().top),
          label: t.getAttribute('aria-label') ?? '',
          mint: {
            opacity: mint.opacity,
            style: mint.borderTopStyle,
            color: mint.borderTopColor,
            transition: mint.transitionProperty,
          },
          ghost: {
            opacity: ghost.opacity,
            style: ghost.borderTopStyle,
            color: ghost.borderTopColor,
            transition: ghost.transitionProperty,
          },
        };
      }),
    );
  }

  it('holds fill, letter color, and height constant across all three states', async () => {
    // Below three letters there is no discard set, so available and used
    // coexist; at three the preview fires and every unused tile goes cold.
    // Both moments are captured, and every tile in both must share one fill,
    // one letter color, and one height.
    await fixedRack(375);
    for (const letter of 'pe') await page.keyboard.press(letter);
    await page.waitForTimeout(250);
    const early = await snapshot();
    await page.keyboard.press('n');
    await page.waitForTimeout(250);
    const late = await snapshot();

    const states = new Set([...early, ...late].map((t) => t.state));
    expect(states).toEqual(new Set(['available', 'used', 'cold']));

    const tiles = [...early, ...late];
    const fills = new Set(tiles.map((t) => t.background));
    const letters = new Set(tiles.map((t) => t.color));
    const tops = new Set(tiles.map((t) => t.top));
    expect(fills.size, [...fills].join(' vs ')).toBe(1);
    expect(letters.size, [...letters].join(' vs ')).toBe(1);
    expect(tops.size, `tops: ${[...tops].join(',')}`).toBe(1);

    // no vertical offset anywhere: an offset alone reads as disabled
    for (const t of tiles) {
      expect(t.transform === 'none' || t.transform.endsWith(', 0)')).toBe(true);
    }
  });

  async function tileStyles() {
    await fixedRack(375);
    for (const letter of 'pen') await page.keyboard.press(letter);
    await page.waitForTimeout(250);
    return snapshot();
  }

  it('marks cold by addition: a ghost violet outline, and nothing removed', async () => {
    const tiles = await tileStyles();
    const cold = tiles.filter((t) => t.state === 'cold');
    const used = tiles.filter((t) => t.state === 'used');
    expect(cold.length).toBeGreaterThan(0);
    expect(used.length).toBeGreaterThan(0);
    // cold shows the ghost violet ring, rgb(169, 163, 201), and no mint
    for (const t of cold) {
      expect(t.ghost.color).toBe('rgb(169, 163, 201)');
      expect(t.ghost.opacity).toBe('1');
      expect(t.mint.opacity).toBe('0');
    }
    // used shows the mint ring, rgb(93, 202, 165), and no ghost
    for (const t of used) {
      expect(t.mint.color).toBe('rgb(93, 202, 165)');
      expect(t.mint.opacity).toBe('1');
      expect(t.ghost.opacity).toBe('0');
    }
  });

  it('fades the rings in and out rather than flipping them', async () => {
    // A border cannot transition its own pattern: crossfading a stroke that
    // is changing from dashed to solid flickers. The rings are separate
    // layers and only their opacity moves, so the state change is smooth.
    const tiles = await tileStyles();
    for (const t of tiles) {
      expect(t.mint.transition).toContain('opacity');
      expect(t.ghost.transition).toContain('opacity');
    }
    const tileTransition = await page.$eval(
      '[data-testid="pool-tile"]',
      (el) => getComputedStyle(el).transitionProperty,
    );
    expect(tileTransition).not.toContain('border');
  });

  it('does not convey cold by color alone', async () => {
    const tiles = await tileStyles();
    const cold = tiles.filter((t) => t.state === 'cold');
    const used = tiles.filter((t) => t.state === 'used');
    // a second, non color mark: the stroke pattern differs from used
    for (const t of cold) expect(t.ghost.style).toBe('dashed');
    for (const t of used) expect(t.mint.style).toBe('solid');
    // and it is spoken, not merely drawn
    for (const t of cold)
      expect(t.label.toLowerCase()).toMatch(/lose|gone|risk/);
  });
});

describe('the control row keeps its shape', () => {
  it('fills the row with thumb sized buttons, matching the display width', async () => {
    // A css splice ate the .entry rule and the buttons collapsed to their
    // text. Nothing caught it, because nothing measured it.
    await fixedRack(375);
    const row = await page.$eval('[data-testid="control-row"]', (el) =>
      Math.round(el.getBoundingClientRect().width),
    );
    const display = await page.$eval('[data-testid="word-display"]', (el) =>
      Math.round(el.getBoundingClientRect().width),
    );
    expect(row).toBe(display);
    const buttons = await page.$$eval(
      '[data-testid="control-row"] button',
      (b) =>
        b.map((x) => ({
          w: Math.round(x.getBoundingClientRect().width),
          h: Math.round(x.getBoundingClientRect().height),
        })),
    );
    expect(buttons).toHaveLength(4);
    for (const b of buttons) {
      expect(b.h).toBeGreaterThanOrEqual(44);
      expect(b.w).toBeGreaterThanOrEqual(60);
    }
    // and together they span the row
    const total = buttons.reduce((sum, b) => sum + b.w, 0);
    expect(total).toBeGreaterThan(row * 0.9);
  }, 30000);
});

describe('cold tiles at phone width', () => {
  it('keeps the tile silhouette: no ghost mask, uniform corners', async () => {
    // A ghost means the letter is gone; a cold tile means it is about to
    // be. The ghost silhouette is reserved for the drift, at every width.
    // A ghost violet outline references the color, never the shape.
    await fixedRack(375);
    for (const letter of 'pen') await page.keyboard.press(letter);
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

describe('the pill is only ever length', () => {
  // The pill was being asked to be a length bar AND a content container. A
  // three letter row cannot hold a word and a number, so the score moves
  // out to a fixed gutter. Row width stays a pure function of word length,
  // which is the rule the whole end screen rests on.
  async function rows(stack: string) {
    return page.$$eval(
      `[data-testid="${stack}"] [data-testid="stack-row"]`,
      (list) =>
        list.map((row) => {
          const pill = row.querySelector('.stack-pill')!;
          const word = row.querySelector('.stack-word')!;
          const score = row.querySelector('.stack-score')!;
          const pillBox = pill.getBoundingClientRect();
          const wordBox = word.getBoundingClientRect();
          const scoreBox = score.getBoundingClientRect();
          return {
            word: word.textContent!.trim(),
            pillWidth: Math.round(pillBox.width),
            wordWidth: Math.round(wordBox.width),
            wordScroll: word.scrollWidth,
            wordClient: word.clientWidth,
            font: getComputedStyle(word).fontSize,
            wordFits:
              wordBox.left >= pillBox.left - 0.5 &&
              wordBox.right <= pillBox.right + 0.5,
            wordOverflows: word.scrollWidth > word.clientWidth + 1,
            scoreRight: Math.round(scoreBox.right),
            scoreOverlapsPill: scoreBox.left < pillBox.right - 0.5,
          };
        }),
    );
  }

  for (const width of [320, 375, 900]) {
    it(`fits three letter rows and lines the scores up at ${width}px`, async () => {
      await endedRun();
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(200);
      let shortRowsSeen = 0;
      for (const stack of ['your-stack', 'par-stack', 'clean-stack']) {
        const list = await rows(stack);
        expect(list.length).toBeGreaterThan(0);
        shortRowsSeen += list.filter((r) => r.word.length <= 3).length;

        for (const row of list) {
          expect(row.wordFits, `${row.word} spills its pill`).toBe(true);
          expect(
            row.wordOverflows,
            `${row.word} clipped: pill ${row.pillWidth}, word ${row.wordWidth}, scroll ${row.wordScroll} vs client ${row.wordClient}, font ${row.font}`,
          ).toBe(false);
          expect(
            row.scoreOverlapsPill,
            `${row.word} score sits on the pill`,
          ).toBe(false);
        }

        // the gutter: every score right aligned to the same x, whatever the
        // pill width does
        const gutter = new Set(list.map((r) => r.scoreRight));
        expect(gutter.size, `${stack} scores at ${[...gutter].join(',')}`).toBe(
          1,
        );

        // and the pill still encodes length, nothing else
        const byLength = new Map<number, number>();
        for (const row of list) {
          const seen = byLength.get(row.word.length);
          if (seen === undefined) byLength.set(row.word.length, row.pillWidth);
          else expect(Math.abs(seen - row.pillWidth)).toBeLessThanOrEqual(1);
        }
        const lengths = [...byLength.keys()].sort((a, b) => a - b);
        for (let i = 1; i < lengths.length; i++) {
          expect(byLength.get(lengths[i]!)!).toBeGreaterThan(
            byLength.get(lengths[i - 1]!)!,
          );
        }
      }
      // the three letter rows are the whole point of this test
      expect(shortRowsSeen).toBeGreaterThan(0);
    }, 40000);
  }
});

describe('one scale across every stack', () => {
  it('renders the same word at the same width in every column', async () => {
    // Width means word length. If a four letter word is a different width
    // in each column, the shapes cannot be compared, which is the entire
    // reason the columns exist.
    await endedRun();
    // PETUNIAS is the eight letter row and it sits in every column,
    // including Clean below the fold
    const eight = FIXED.onEveryPath;
    const yours = await rowWidth('your-stack', eight);
    const best = await rowWidth('par-stack', eight);
    const clean = await rowWidth('clean-stack', eight);
    expect(yours).toBeGreaterThan(0);
    expect(Math.abs(yours - best)).toBeLessThanOrEqual(1);
    expect(Math.abs(best - clean)).toBeLessThanOrEqual(1);

    // a shorter word measures shorter, by the same unit, everywhere
    const seven = await rowWidth('par-stack', 'PANTIES');
    expect(seven).toBeLessThan(best);
    expect(
      Math.abs(seven - (await rowWidth('clean-stack', 'PANTIES'))),
    ).toBeLessThanOrEqual(1);

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

/**
 * The ceremony, and the furniture around it. Everything below is spatial or
 * computed-style, so it must be measured in a real browser: jsdom has no
 * layout engine, and an earlier build was fully green in jsdom while the
 * rack wrapped 6 and 2 on a real phone.
 *
 * Endless seed 19 is CADUCEUS and CAUCUSED, two common-pool eights, and it
 * is a pure function of the committed calendar, so it never moves. Seed 1
 * (PETUNIAS) carries exactly one, and is the absence case.
 */
const TWO_EIGHTS = {
  seed: 19,
  rack: 'accdesuu',
  words: ['caduceus', 'caucused'],
};

async function seededRack(
  width: number,
  fixture: { seed: number; rack: string },
) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
  });
  page = await context.newPage();
  await page.addInitScript((f) => {
    localStorage.setItem(
      'oos:endless-current',
      JSON.stringify({
        rack: f.rack,
        words: [],
        stopped: false,
        endlessSeed: f.seed,
      }),
    );
  }, fixture);
  await page.goto(origin);
  await page.waitForSelector('[data-ready="true"]');
  await page.getByRole('button', { name: 'Endless' }).click();
  await page.waitForSelector('[data-testid="pool-tile"]');
}

/** A finished run on the two-eight rack, with both eights found. */
async function allEightsRun(width = 375) {
  await seededRack(width, TWO_EIGHTS);
  for (const w of TWO_EIGHTS.words) await play(w);
  await page.getByRole('button', { name: 'Stop' }).click();
  await page.waitForSelector('[data-testid="end-screen"]');
}

function styleOf(selector: string, props: string[]) {
  return page.$eval(
    selector,
    (el, names) => {
      const cs = getComputedStyle(el);
      return Object.fromEntries(
        names.map((n) => [n, cs.getPropertyValue(n)]),
      ) as Record<string, string>;
    },
    props,
  );
}

describe('the mint mark on the eights is not clipped', () => {
  it('the end screen stacks never inherit the play stack scroll clip', async () => {
    await allEightsRun();
    // The stack is a scroll container during play (max-height, overflow-y
    // auto), and the end screen inherited the overflow while dropping the
    // max-height. It clipped the eights' mark at the container's top edge.
    // The mark is now an inset ring, painted INSIDE the pill, so it cannot
    // be cut at all; this guard stays anyway, because the next decoration
    // added here will not necessarily be an inset one.
    const stack = await styleOf('[data-testid="par-stack"]', [
      'overflow-x',
      'overflow-y',
    ]);
    expect(stack['overflow-x']).toBe('visible');
    expect(stack['overflow-y']).toBe('visible');

    // And the mark is really there, on the eight rows, in mint. Same ring in
    // every column: see test/scale.test.ts for the grammar it belongs to.
    const pill = await styleOf(
      '[data-testid="par-stack"] [data-eight] .stack-pill',
      ['box-shadow', 'outline-style'],
    );
    expect(pill['box-shadow']).toContain('rgb(93, 202, 165)');
    expect(pill['box-shadow']).toContain('inset');
    expect(pill['outline-style']).toBe('none');
  }, 30000);

  it('nothing cuts the outline on any edge, at any width', async () => {
    for (const width of [375, 1024]) {
      await allEightsRun(width);
      // The real definition of clipped: an ancestor that clips (any overflow
      // but visible) whose padding box does not contain the whole outline
      // box. An outline is painted OUTSIDE the border box, so a pill flush
      // with the top of a scroll container loses its top edge, which is
      // exactly what happened and exactly what a screenshot showed.
      const cut = await page.evaluate(() => {
        const bad: string[] = [];
        for (const pill of document.querySelectorAll(
          '.stack-compare [data-eight] .stack-pill',
        )) {
          const w = parseFloat(getComputedStyle(pill).outlineWidth);
          const r = pill.getBoundingClientRect();
          const box = {
            top: r.top - w,
            bottom: r.bottom + w,
            left: r.left - w,
            right: r.right + w,
          };
          for (
            let el = pill.parentElement;
            el && el !== document.body;
            el = el.parentElement
          ) {
            const cs = getComputedStyle(el);
            const clips = ![cs.overflowX, cs.overflowY].every(
              (o) => o === 'visible',
            );
            if (!clips) continue;
            const a = el.getBoundingClientRect();
            if (
              box.top < a.top ||
              box.bottom > a.bottom ||
              box.left < a.left ||
              box.right > a.right
            ) {
              bad.push(
                `${el.className || el.tagName} clips ${pill.textContent}`,
              );
            }
          }
        }
        return bad;
      });
      expect(cut, `at ${width}px`).toEqual([]);
    }
  }, 60000);
});

describe('the end screen headline is the idiom, not the title', () => {
  it('does not read as the masthead printed twice', async () => {
    await allEightsRun();
    // The line does not change: it is the entire reason the game has that
    // name, and it fires only when the pool is genuinely dead. What changes
    // is how it is set. If it matches the masthead in size, weight AND
    // color, a stranger reads a duplicate heading and the joke stutters.
    const headline = await styleOf('.end-screen h2', [
      'font-size',
      'font-weight',
      'color',
      'font-style',
    ]);
    const masthead = await styleOf('.masthead h1', [
      'font-size',
      'font-weight',
      'color',
      'font-style',
    ]);
    expect(headline).not.toEqual(masthead);
    expect(headline['font-size']).not.toBe(masthead['font-size']);
    expect(headline['color']).not.toBe(masthead['color']);
    expect(parseInt(headline['font-size']!)).toBeLessThan(
      parseInt(masthead['font-size']!),
    );
    // Quiet: plum, not the brand violet. Violet is chrome and brand only.
    expect(headline['color']).toBe('rgb(60, 52, 137)');
    expect(masthead['color']).toBe('rgb(127, 119, 221)');
  }, 30000);
});

describe('sharing never moves the page', () => {
  /** Position in the DOCUMENT, not the viewport. A click scrolls the button
   * into view, so viewport coordinates move even when nothing reflows, and a
   * test that measured those would be measuring the scroll. */
  async function geometry() {
    return page.evaluate(() => {
      const top = (sel: string) =>
        Math.round(
          document.querySelector(sel)!.getBoundingClientRect().top +
            window.scrollY,
        );
      return {
        footer: top('.footer'),
        button: top('[data-testid="share-button"]'),
        buttonWidth: Math.round(
          document
            .querySelector('[data-testid="share-button"]')!
            .getBoundingClientRect().width,
        ),
        documentHeight: document.documentElement.scrollHeight,
      };
    });
  }

  it('the footer does not shift when the label swaps to Copied', async () => {
    await allEightsRun();
    await page.evaluate(() => {
      // A clipboard write needs permission in a headless context, and there
      // is no native sheet here. The feature detection is unit tested; what
      // must be measured in a real browser is that the page HOLDS STILL when
      // the label changes.
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: () => Promise.resolve() },
        configurable: true,
      });
    });
    const before = await geometry();
    await page.getByTestId('share-button').click();
    await page.waitForSelector('[data-testid="share-button"][data-copied]');
    const after = await geometry();
    // Every one of these moved when "Copied." was a new paragraph below the
    // buttons: the button kept its place and the footer was pushed down.
    expect(after).toEqual(before);
  }, 30000);
});

describe('the focus ring is designed, and it is violet', () => {
  it('every focusable thing takes a visible violet ring, and never amber', async () => {
    await seededRack(375, TWO_EIGHTS);
    // A focus ring is a real thing real users see, keyboard users
    // constantly. The browser default was never designed; on the Endless
    // chip it rendered amber, which is Peach's crown and is banned outright.
    await page.keyboard.press('Tab');
    for (let i = 0; i < 8; i++) {
      const ring = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        return {
          tag: el.tagName,
          color: cs.outlineColor,
          width: parseFloat(cs.outlineWidth),
          style: cs.outlineStyle,
        };
      });
      if (ring) {
        expect(ring.style, `${ring.tag} has no focus ring`).not.toBe('none');
        expect(
          ring.width,
          `${ring.tag} ring is invisible`,
        ).toBeGreaterThanOrEqual(2);
        expect(ring.color, `${ring.tag} ring is not violet`).toBe(
          'rgb(127, 119, 221)',
        );
      }
      await page.keyboard.press('Tab');
    }
  }, 30000);

  it('no amber anywhere in the rendered styles, focus rings included', async () => {
    await allEightsRun();
    await page.keyboard.press('Tab');
    // Amber above all. Sweep every computed color-bearing property on every
    // element, including the focused one, and assert nothing lands in the
    // amber band.
    const offenders = await page.evaluate(() => {
      const isAmber = (value: string) => {
        const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(value);
        if (!m) return false;
        const [r, g, b] = [+m[1]!, +m[2]!, +m[3]!];
        // Amber and oxblood: a strong red channel with little blue. Mint,
        // violet, plum, rose and the lilac ground all carry real blue.
        return r > 150 && b < 90 && g < r;
      };
      const found: string[] = [];
      for (const el of document.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        for (const prop of [
          'color',
          'background-color',
          'border-top-color',
          'outline-color',
          'text-decoration-color',
        ]) {
          const value = cs.getPropertyValue(prop);
          if (isAmber(value)) {
            found.push(`${el.tagName}.${el.className} ${prop}: ${value}`);
          }
        }
      }
      return found;
    });
    expect(offenders).toEqual([]);
  }, 30000);
});

describe('the streak says what it is', () => {
  it('labels the number instead of leaving a bare count of days', async () => {
    await seededRack(375, TWO_EIGHTS);
    // A bare "3 days" says nothing about what the 3 counts. Peach says
    // "Streak 1", and it is legible in one glance.
    // A LIVE streak, seeded against the real storage epoch. It used to say
    // lastDayIndex 99999, which is neither today nor yesterday: the display
    // read `.length` raw so it rendered anyway, and the fixture could never
    // have caught a dead streak being displayed.
    await page.evaluate(
      (lastDayIndex) =>
        localStorage.setItem(
          'oos:streak',
          JSON.stringify({ length: 3, lastDayIndex }),
        ),
      storageDayIndex(new Date()),
    );
    await page.reload();
    await page.waitForSelector('[data-ready="true"]');
    const streak = await page.textContent('[data-testid="streak"]');
    expect(streak).toMatch(/streak/i);
    expect(streak).toContain('3');
  }, 30000);

  it('does not run into the score: a rendered boundary, not a space', async () => {
    // "Streak 3 0 points" read as one string. They are different kinds of
    // thing: the streak survives the day, the score belongs to this run.
    // Whitespace alone does not say that, so the streak carries a border.
    await dailyMidRun(375, 3);
    const edge = await page.evaluate(() => {
      const drawn = (el: Element, side: 'Left' | 'Right') => {
        const cs = getComputedStyle(el);
        const style = cs.getPropertyValue(`border-${side.toLowerCase()}-style`);
        return (
          parseFloat(
            cs.getPropertyValue(`border-${side.toLowerCase()}-width`),
          ) > 0 &&
          style !== 'none' &&
          style !== 'hidden'
        );
      };
      const streak = document.querySelector('[data-testid="streak"]')!;
      const score = document.querySelector('[data-testid="running-score"]')!;
      // Whichever side of the boundary carries it, so long as one does.
      return drawn(streak, 'Right') || drawn(score, 'Left');
    });
    expect(edge, 'nothing is drawn between the streak and the score').toBe(
      true,
    );

    // and the two are not touching: real space either side of the boundary
    const gap = await page.evaluate(() => {
      const s = document
        .querySelector('[data-testid="streak"]')!
        .getBoundingClientRect();
      const p = document
        .querySelector('[data-testid="running-score"]')!
        .getBoundingClientRect();
      return p.left - s.right;
    });
    expect(gap).toBeGreaterThanOrEqual(8);
  }, 40000);

  it('does not dangle that edge when there is no score to divide from', async () => {
    // A run has not started, so the streak stands alone in the header. A
    // divider with nothing on the far side of it is a rule pointing at
    // empty space. The boundary belongs to the PAIR, not to the streak.
    // The score needs a run, and a run needs the engine. On a cold load the
    // header paints the streak first and the score lands a frame later, so
    // the frame is real and easy to miss by polling. Watched from before
    // first paint, the way the rack flash is.
    const dangled = await coldHeaderDangle(375, 3);
    expect(dangled, 'the streak painted a divider with nothing after it').toBe(
      false,
    );
  }, 40000);
});

/**
 * Loads today's daily cold with a streak on the clock and reports whether
 * the streak ever painted a side border while no running score existed.
 */
async function coldHeaderDangle(
  width: number,
  streak: number,
): Promise<boolean> {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
  });
  page = await context.newPage();
  await page.addInitScript(
    (seed) => {
      localStorage.setItem(
        'oos:streak',
        JSON.stringify({
          length: seed.length,
          lastDayIndex: seed.lastDayIndex,
        }),
      );
      const w = window as unknown as { __dangled: boolean };
      w.__dangled = false;
      const look = () => {
        const s = document.querySelector('[data-testid="streak"]');
        if (!s) return;
        if (document.querySelector('[data-testid="running-score"]')) return;
        const cs = getComputedStyle(s);
        if (
          parseFloat(cs.borderRightWidth) > 0 ||
          parseFloat(cs.borderLeftWidth) > 0
        ) {
          w.__dangled = true;
        }
      };
      new MutationObserver(look).observe(document, {
        childList: true,
        subtree: true,
      });
    },
    { length: streak, lastDayIndex: storageDayIndex(new Date()) },
  );
  await page.goto(origin);
  await page.waitForSelector('[data-ready="true"]');
  await page.waitForTimeout(300);
  return page.evaluate(
    () => (window as unknown as { __dangled: boolean }).__dangled,
  );
}

/**
 * Today's real daily, mid run, with a streak on the clock: the only state
 * where the streak and the running score are on screen together. Seeded
 * from the committed calendar and the engine's own par path, so it holds on
 * any day.
 */
async function dailyMidRun(width: number, streak: number) {
  const { entry } = todaysDaily();
  const puzzle = liveEngine().createPuzzle(entry.rack);
  const words = puzzle.parPath.slice(0, 1);

  const context = await browser.newContext({
    viewport: { width, height: 900 },
  });
  page = await context.newPage();
  await page.addInitScript(
    (fixture) => {
      localStorage.setItem(
        `oos:${fixture.key}`,
        JSON.stringify({
          rack: fixture.rack,
          words: fixture.words,
          stopped: false,
        }),
      );
      localStorage.setItem(
        'oos:streak',
        JSON.stringify({
          length: fixture.streak,
          lastDayIndex: fixture.lastDayIndex,
        }),
      );
    },
    {
      key: dailyRunKey(new Date()),
      rack: entry.rack,
      words,
      streak,
      lastDayIndex: storageDayIndex(new Date()),
    },
  );
  await page.goto(origin);
  await page.waitForSelector('[data-ready="true"]');
  await page.waitForSelector('[data-testid="running-score"]');
}

/**
 * Every control button on the board, in rendered position. Rows are read
 * off the geometry, not the DOM: what the thumb meets is where the buttons
 * actually are.
 */
async function controlRows(): Promise<
  { label: string; rect: DOMRectLike }[][]
> {
  const buttons = await page.$$eval('[data-testid="control-row"] button', (b) =>
    b.map((x) => {
      const r = x.getBoundingClientRect();
      return {
        label: (x.getAttribute('aria-label') ?? x.textContent ?? '').trim(),
        rect: {
          top: r.top,
          bottom: r.bottom,
          left: r.left,
          right: r.right,
          width: r.width,
          height: r.height,
        },
      };
    }),
  );
  // Same row means the boxes overlap vertically, which is what "shoulder to
  // shoulder under a thumb" actually means.
  const rows: { label: string; rect: DOMRectLike }[][] = [];
  for (const b of [...buttons].sort((x, y) => x.rect.top - y.rect.top)) {
    const row = rows.find((r) =>
      r.some(
        (o) => b.rect.top < o.rect.bottom - 1 && o.rect.top < b.rect.bottom - 1,
      ),
    );
    if (row) row.push(b);
    else rows.push([b]);
  }
  for (const r of rows) r.sort((a, b) => a.rect.left - b.rect.left);
  return rows;
}

type DOMRectLike = {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
};

const SPEND = /^spend$/i;
const BACKSPACE = /delete last letter/i;

describe('the thumb never finds Spend by accident', () => {
  // Spend is the only irreversible control in the game: it destroys letters
  // and there is no undo. Backspace is the most tapped. The dangerous
  // moment is specific: a valid word typed, second thoughts, a fast reach
  // for backspace. The two must never sit shoulder to shoulder.
  for (const width of [320, 375, 390]) {
    it(`wraps to two rows with Spend alone on the second at ${width}px`, async () => {
      await fixedRack(width);
      const rows = await controlRows();
      expect(rows).toHaveLength(2);
      expect(rows[0]!.map((b) => b.label)).toEqual([
        'Shuffle',
        'Clear',
        'Delete last letter',
      ]);
      expect(rows[1]!.map((b) => b.label)).toEqual(['Spend']);
    }, 40000);

    it(`gives Spend the widest target on the board at ${width}px`, async () => {
      await fixedRack(width);
      const rows = await controlRows();
      const spend = rows[1]![0]!;
      const row = await page.$eval('[data-testid="control-row"]', (el) =>
        Math.round(el.getBoundingClientRect().width),
      );
      expect(Math.round(spend.rect.width)).toBeGreaterThanOrEqual(row - 2);
      for (const b of rows[0]!) {
        expect(spend.rect.width).toBeGreaterThan(b.rect.width);
      }
    }, 40000);
  }

  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    it(`never puts Spend beside backspace at ${width}px`, async () => {
      // The invariant, and the point of the whole change. Adjacent means
      // sharing a row: a full width Spend necessarily sits BELOW backspace,
      // and that is the safe direction, guarded by the gap asserted next.
      await fixedRack(width);
      const rows = await controlRows();
      for (const row of rows) {
        const labels = row.map((b) => b.label);
        const together =
          labels.some((l) => SPEND.test(l)) &&
          labels.some((l) => BACKSPACE.test(l));
        expect(together, `Spend shares a row with backspace: ${labels}`).toBe(
          false,
        );
      }
    }, 40000);

    it(`keeps real air above and below Spend at ${width}px`, async () => {
      await fixedRack(width);
      const rows = await controlRows();
      const spend = rows.flat().find((b) => SPEND.test(b.label))!;
      const above = rows
        .flat()
        .filter((b) => b.rect.bottom <= spend.rect.top + 1)
        .map((b) => spend.rect.top - b.rect.bottom);
      for (const gap of above) expect(gap).toBeGreaterThanOrEqual(8);

      // Stop also ends the run, and it must not creep up to meet a Spend
      // that just moved down the board.
      const stop = await page.$eval('.stop-button', (e) => {
        const r = e.getBoundingClientRect();
        return { top: r.top, left: r.left, right: r.right };
      });
      expect(
        stop.top - spend.rect.bottom,
        'Stop crept up to meet Spend',
      ).toBeGreaterThanOrEqual(24);
    }, 40000);

    it(`meets the 44 by 44 touch minimum on every control at ${width}px`, async () => {
      await fixedRack(width);
      const rows = await controlRows();
      const controls = rows.flat();
      expect(controls).toHaveLength(4);
      for (const b of controls) {
        expect(
          Math.round(b.rect.width),
          `${b.label} is ${b.rect.width}px wide`,
        ).toBeGreaterThanOrEqual(44);
        expect(
          Math.round(b.rect.height),
          `${b.label} is ${b.rect.height}px tall`,
        ).toBeGreaterThanOrEqual(44);
      }
      const stop = await page.$eval('.stop-button', (e) => {
        const r = e.getBoundingClientRect();
        return { w: r.width, h: r.height };
      });
      expect(Math.round(stop.w)).toBeGreaterThanOrEqual(44);
      expect(Math.round(stop.h)).toBeGreaterThanOrEqual(44);
    }, 40000);
  }

  it('keeps Stop away from Spend in the DOM as well as on screen', async () => {
    // Rendered distance is what the thumb meets; DOM order is what a
    // keyboard and a screen reader meet. Both have to hold.
    await fixedRack(375);
    const between = await page.evaluate(() => {
      const focusable = [
        ...document.querySelectorAll('button, [tabindex]:not([tabindex="-1"])'),
      ];
      const spend = focusable.findIndex(
        (e) => e.textContent!.trim().toLowerCase() === 'spend',
      );
      const stop = focusable.findIndex(
        (e) => e.textContent!.trim().toLowerCase() === 'stop',
      );
      return stop - spend;
    });
    expect(between).toBeGreaterThanOrEqual(1);
  }, 40000);
});
