// One mint, one scale.
//
// ONE SCALE. Row width is a pure function of word length and rack size,
// shared by every stack on the screen. It is the rule the entire silhouette
// rests on, it is why the end screen was rebuilt away from word chains, and
// it has broken twice. Decoration (a ring, a dash, an inset, padding) must
// never enter the width basis: a seven letter word is the same width
// wherever it appears, decorated or not.
//
// ONE MINT. Mint means the eights, and there were three treatments of it on
// one screen: a solid fill in Yours, a dashed outline in Best, a pale chip
// in the reveal. The stacks now share one grammar, the same one the tiles
// took three attempts to learn: THE RING CARRIES THE STATUS, THE FILL IS
// HELD CONSTANT. The reveal keeps its fill because it is a different kind of
// object, a celebration chip and not a stack row.
//
// Measured in a real browser. jsdom has no layout engine, and every one of
// these assertions is a width or a computed style.
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

/**
 * Endless seed 1 (PETUNIAS, rack AEINPSTU) is a pure function of the
 * committed calendar, so it never moves. Its par path is NOT clean, so the
 * end screen carries all three columns, and the played words below put
 * lengths 8, 7, 5, 4 and 3 into Yours alongside Best and Clean.
 */
const FIXED = {
  seed: 1,
  rack: 'aeinpstu',
  words: ['petunias', 'panties', 'paste', 'apes', 'pea'],
};

const MINT = 'rgb(93, 202, 165)';

interface Row {
  col: string;
  word: string;
  len: number;
  width: number;
  background: string;
  shadow: string;
  outline: string;
}

async function endScreen(width: number): Promise<Row[]> {
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
  for (const word of FIXED.words) {
    await page.keyboard.press('Escape');
    for (const letter of word) await page.keyboard.press(letter);
    await page.keyboard.press('Enter');
  }
  // The run may end itself: the pool dies when the common ladder is spent.
  if (await page.$('button:text-is("Stop")')) {
    await page.getByRole('button', { name: 'Stop' }).click();
  }
  await page.waitForSelector('[data-testid="end-screen"]');
  return page.evaluate(() => {
    const out = [];
    for (const id of ['your-stack', 'par-stack', 'clean-stack']) {
      const stack = document.querySelector(`[data-testid="${id}"]`);
      if (!stack) continue;
      for (const row of stack.querySelectorAll('[data-testid="stack-row"]')) {
        const pill = row.querySelector('.stack-pill') as HTMLElement;
        const cs = getComputedStyle(pill);
        const word = pill.textContent!.trim();
        out.push({
          col: id,
          word,
          len: word.length,
          width: pill.getBoundingClientRect().width,
          background: cs.backgroundColor,
          shadow: cs.boxShadow,
          outline: cs.outlineStyle,
        });
      }
    }
    return out;
  });
}

const eights = (rows: Row[]) => rows.filter((r) => r.len === 8);

describe('one scale: width is a pure function of length', () => {
  for (const viewport of [390, 1280]) {
    it(`the same length is the same width in every column at ${viewport}px`, async () => {
      const rows = await endScreen(viewport);
      const byLength = new Map<number, Row[]>();
      for (const row of rows) {
        byLength.set(row.len, [...(byLength.get(row.len) ?? []), row]);
      }

      // Every length the rack produced, 3 through 8, is on the screen.
      for (const len of [3, 4, 5, 6, 7, 8]) {
        expect(byLength.get(len), `no rows of length ${len}`).toBeTruthy();
      }

      for (const [len, group] of byLength) {
        const widths = new Set(group.map((r) => r.width.toFixed(2)));
        expect(
          [...widths],
          `length ${len} rendered at ${[...widths].join(' and ')} across ` +
            group.map((r) => `${r.col}:${r.word}`).join(', '),
        ).toHaveLength(1);
      }

      // And it spans columns: a within-column-only check would pass on a
      // screen where every column had its own private scale, which is the
      // exact bug.
      const spanning = [...byLength.values()].filter(
        (g) => new Set(g.map((r) => r.col)).size > 1,
      );
      expect(spanning.length).toBeGreaterThanOrEqual(4);
    }, 60000);
  }

  it('decoration never enters the width basis', async () => {
    // The eight rows are decorated and the short rows are not. If a ring, an
    // inset or a padding ever crept into the basis, the width per letter
    // would differ between a decorated row and a bare one. Width divided by
    // length is the unit, and it is one number for the whole screen.
    const rows = await endScreen(1280);
    const units = rows.map((r) => ({
      word: r.word,
      unit: r.width / r.len,
    }));
    const low = Math.min(...units.map((u) => u.unit));
    const high = Math.max(...units.map((u) => u.unit));
    // A tolerance, and a tight one. Sub-pixel drift is what a browser does
    // to calc(); a decoration that ate into the basis would cost whole
    // pixels per letter, not thousandths. The old mint fill and the dashed
    // outline both leave this untouched, which is exactly the point: an
    // outline is painted outside the border box and never was the cause.
    expect(
      high - low,
      units.map((u) => `${u.word}=${u.unit.toFixed(3)}`).join(' '),
    ).toBeLessThan(0.05);
  }, 60000);
});

describe('one mint: the ring carries the eights, the fill is held constant', () => {
  it('marks an eight the same way in Yours and in Best', async () => {
    const rows = await endScreen(1280);
    const marked = eights(rows);
    expect(new Set(marked.map((r) => r.col)).size).toBeGreaterThanOrEqual(2);
    // Same mint ring in every column. The fill already carries yours versus
    // possible, and mint does not need to carry it too.
    for (const row of marked) {
      expect(row.shadow, `${row.col} ${row.word}`).toContain(MINT);
      expect(row.shadow, `${row.col} ${row.word}`).toContain('inset');
    }
  }, 60000);

  it('never fills a stack row with mint', async () => {
    // A solid mint bar was the loudest object on the page, louder than the
    // headline, competing with the ceremony above it. At risk, and at rest,
    // are both marked by ADDITION: the ring is added, nothing else moves.
    const rows = await endScreen(1280);
    for (const row of rows) {
      expect(row.background, `${row.col} ${row.word} is filled mint`).not.toBe(
        MINT,
      );
    }
    // And the eights still carry their own fill, unchanged from their
    // neighbours in the same column: white in Yours, ghosted in Best.
    for (const col of ['your-stack', 'par-stack']) {
      const inColumn = rows.filter((r) => r.col === col);
      const fills = new Set(inColumn.map((r) => r.background));
      expect([...fills], `${col} fills`).toHaveLength(1);
    }
  }, 60000);

  it('the mark cannot be clipped, on any edge, in any column', async () => {
    // The dashed OUTLINE was clipped by the stack's scroll container,
    // because an outline is painted outside the border box. An inset ring is
    // painted inside it and cannot be cut at all. The overflow guard stays
    // anyway: the stack is a scroll container during play, and nothing on
    // the end screen may inherit that.
    const rows = await endScreen(390);
    expect(eights(rows).length).toBeGreaterThan(0);
    for (const row of eights(rows)) {
      expect(row.outline, `${row.col} ${row.word}`).toBe('none');
    }
    const overflow = await page.$eval('[data-testid="par-stack"]', (el) => {
      const cs = getComputedStyle(el);
      return [cs.overflowX, cs.overflowY];
    });
    expect(overflow).toEqual(['visible', 'visible']);
  }, 60000);
});
