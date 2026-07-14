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

  for (const width of [320, 375, 768, 1440]) {
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
