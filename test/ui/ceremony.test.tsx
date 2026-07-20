// @vitest-environment jsdom
// The ceremony. All Eights fires on 9.8 percent of racks and it is the
// rarest, hardest thing the game can produce, so the end screen says so in
// words before it says anything else. Quiet warmth, never fireworks: the
// register is gentle, plain, a little sad, and a celebration that reads as
// perky has failed.
//
// The rule that governs its absence is the same one that governs the badge:
// on a single-eight rack the ceremony does not exist. ABSENCE, NEVER
// FAILURE. A rack with one eight is not a rack you failed.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EndScreen } from '../../src/ui/components/EndScreen';
import { deliverShare } from '../../src/ui/share-out';
import { createEngine, type Puzzle } from '../../src/engine/engine';
import { wordScore } from '../../src/engine/values';
import type { PlayedWord, RunResult } from '../../src/engine/run';
import { realDicts } from '../helpers/dicts';

afterEach(cleanup);

const engine = createEngine(realDicts());

/** Racks chosen from the real calendar for their common-pool eight count.
 * The count comes from the solver's hold inventory, never the calendar's
 * baked boundary list: AEGINRST carries 5 common eights and 12 boundary
 * ones, and confusing the two is the bug the badge was designed against. */
const RACKS = {
  one: 'aeinpstu', // PETUNIAS. No badge, no ceremony.
  two: 'emprsttu', // STRUMPET, TRUMPETS.
  three: 'adeegnrs', // DERANGES, GRANDEES, GRENADES.
  five: 'aeginrst', // ANGRIEST, GANTRIES, INGRATES, RANGIEST, TASERING.
} as const;

function rows(words: readonly string[]): PlayedWord[] {
  return words.map((w) => ({ word: w, score: wordScore(w), length: w.length }));
}

function result(played: readonly string[]): RunResult {
  return {
    score: played.reduce((a, w) => a + wordScore(w), 0),
    words: rows(played),
    endReason: 'clean-finish',
    finalPoolSize: 3,
    isCleanDescent: true,
  };
}

function show(puzzle: Puzzle, played: readonly string[], onShare = () => {}) {
  render(
    <EndScreen
      puzzle={puzzle}
      result={result(played)}
      played={rows(played)}
      label={null}
      onShare={onShare}
      onNewEndless={null}
    />,
  );
}

describe('the all eights ceremony', () => {
  it('fires when the rack holds two eights and the player found them both', () => {
    const puzzle = engine.createPuzzle(RACKS.two);
    expect(puzzle.holds.fullRackWords).toHaveLength(2);
    show(puzzle, ['strumpet', 'trumpets']);
    expect(screen.getByTestId('ceremony')).toBeTruthy();
  });

  it('does not fire when one of the two eights was missed', () => {
    const puzzle = engine.createPuzzle(RACKS.two);
    show(puzzle, ['strumpet']);
    expect(screen.queryByTestId('ceremony')).toBeNull();
    // The badge still shows the shortfall. The ceremony is the peak, not
    // the scoreboard.
    expect(screen.getByTestId('badge-all-eights').textContent).toContain('1/2');
  });

  it('does not exist on a single-eight rack, even having found it', () => {
    // Absence, never failure. 90.2 percent of racks have exactly one eight,
    // and a ceremony for playing the obvious opener is not a ceremony.
    const puzzle = engine.createPuzzle(RACKS.one);
    expect(puzzle.holds.fullRackWords).toHaveLength(1);
    show(puzzle, ['petunias']);
    expect(screen.queryByTestId('ceremony')).toBeNull();
    expect(screen.queryByTestId('badge-all-eights')).toBeNull();
    expect(screen.queryByTestId('eights-reveal')).toBeNull();
  });

  it('reveals every eight the solver found, at two, three and five', () => {
    // The chosen line ("You left nothing in the case.") carries no count, so
    // there is no number to pluralize. What must scale with the engine is
    // the REVEAL: all of them, exactly, whatever the rack holds.
    for (const rack of [RACKS.two, RACKS.three, RACKS.five]) {
      cleanup();
      const puzzle = engine.createPuzzle(rack);
      const eights = puzzle.holds.fullRackWords;
      show(puzzle, eights);
      const reveal = screen.getByTestId('eights-reveal');
      const shown = [...reveal.querySelectorAll('[data-testid="eight-word"]')];
      expect(shown).toHaveLength(eights.length);
      expect(shown.map((e) => e.textContent)).toEqual(
        eights.map((w) => w.toUpperCase()),
      );
    }
  });

  it('says so before the score: the ceremony precedes the badges', () => {
    // "It should be the first thing the player reads, above the badges."
    // Document order is the reading order, and it is what a screen reader
    // follows too.
    const puzzle = engine.createPuzzle(RACKS.two);
    show(puzzle, ['strumpet', 'trumpets']);
    const ceremony = screen.getByTestId('ceremony');
    const badges = screen.getByTestId('badge-all-eights');
    const score = screen.getByTestId('end-sub');
    for (const later of [score, badges]) {
      expect(
        ceremony.compareDocumentPosition(later) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it('never shouts: no exclamation mark anywhere on the end screen', () => {
    const puzzle = engine.createPuzzle(RACKS.five);
    show(puzzle, puzzle.holds.fullRackWords);
    expect(document.body.textContent).not.toContain('!');
  });
});

describe('the share button', () => {
  const puzzle = engine.createPuzzle(RACKS.two);

  afterEach(() => vi.unstubAllGlobals());

  it('uses the native share sheet when the browser has one', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share, clipboard: { writeText } });
    expect(await deliverShare('hello')).toBe('shared');
    expect(share).toHaveBeenCalledWith({ text: 'hello' });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('falls back to the clipboard when it does not', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await deliverShare('hello')).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('feature-detects, and never sniffs the user agent', async () => {
    // A phone with no share sheet must still copy, and a desktop with one
    // must still use it. The capability is the question, never the device.
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      userAgent: 'iPhone',
      clipboard: { writeText },
    });
    expect(await deliverShare('hello')).toBe('copied');
  });

  it('a cancelled share sheet is not a failure, and does not silently copy', async () => {
    const share = vi.fn().mockRejectedValue(
      Object.assign(new Error('cancelled'), { name: 'AbortError' }),
    );
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share, clipboard: { writeText } });
    expect(await deliverShare('hello')).toBe('cancelled');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('swaps its label in place, so copying cannot move the page', () => {
    // "Copied." used to appear as a NEW paragraph below the buttons, which
    // pushed the footer down on every copy. Both labels are always in the
    // DOM, stacked in one grid cell, so the button is already as wide as its
    // widest state and nothing reflows when the label changes.
    show(puzzle, ['strumpet', 'trumpets']);
    const button = screen.getByTestId('share-button');
    expect(button.querySelector('[data-testid="share-idle"]')).toBeTruthy();
    expect(button.querySelector('[data-testid="share-done"]')).toBeTruthy();
  });
});
