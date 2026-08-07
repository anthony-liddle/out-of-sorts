// @vitest-environment jsdom
//
// Two displays that claimed something the state did not support: a streak
// read raw from storage without asking whether it was still alive, and a
// DAY N label derived from an epoch that has already moved once.
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/ui/App';
import { buildDictionaries } from '../../src/engine/dictionary';
import { memoryStorage } from '../../src/game/persistence';
import { storageDayIndex } from '../../src/calendar/epochs';
import { silentAudio } from '../../src/ui/audio';
import type { GameServices } from '../../src/ui/services';
import type { Calendar } from '../../src/calendar/types';

afterEach(cleanup);

const WORDS = [
  'triangle',
  'relating',
  'tearing',
  'rating',
  'grain',
  'grin',
  'ring',
  'gin',
  'rig',
  'nag',
  'ant',
];
const DICTS = buildDictionaries({
  enable: WORDS,
  scowl95Extra: [],
  allow: [],
  deny: [],
  common: WORDS,
  source: [],
});

// Two entries, so a date change actually selects a different rack and the
// share cannot pass the midnight test by accident.
const CALENDAR: Calendar = {
  epoch: '2026-08-01',
  entries: [
    { rack: 'aegilnrt', eights: ['relating', 'triangle'] },
    { rack: 'aegilnrs', eights: [] },
  ],
};

/** 2026-08-01 local, mid morning: the calendar epoch, so entry 0. */
const DAY_ONE = new Date(2026, 7, 1, 10, 0);

function services(overrides: Partial<GameServices> = {}): GameServices {
  return {
    loadCalendar: async () => CALENDAR,
    loadDictionaries: () => ({ dictionaries: Promise.resolve(DICTS) }),
    storage: memoryStorage(),
    audio: silentAudio,
    now: () => DAY_ONE,
    reducedMotionDefault: false,
    ...overrides,
  };
}

async function ready() {
  await waitFor(() =>
    expect(document.querySelector('[data-ready="true"]')).toBeTruthy(),
  );
}

/** Seed a stored streak record `gap` days behind the app's own today. */
function storedStreak(length: number, gap: number, now: Date) {
  const storage = memoryStorage();
  storage.setItem(
    'oos:streak',
    JSON.stringify({ length, lastDayIndex: storageDayIndex(now) - gap }),
  );
  return storage;
}

describe('the board does not say DAY N', () => {
  it('renders no day label on the daily, at any width', async () => {
    render(<App services={services()} />);
    await ready();
    expect(document.querySelector('.day-label')).toBeNull();
    expect(document.body.textContent).not.toMatch(/\bDay\s*\d/i);
  });

  it('but Endless keeps its session counter', async () => {
    render(<App services={services()} />);
    await ready();
    await userEvent.click(screen.getByRole('button', { name: /endless/i }));
    await waitFor(() =>
      expect(document.querySelector('.day-label')?.textContent).toBe(
        'Endless 1',
      ),
    );
  });
});

describe('the share names the date', () => {
  let copied: string;

  beforeEach(() => {
    copied = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn(async (text: string) => {
          copied = text;
        }),
      },
    });
    // No native sheet in this environment: the clipboard route is the one
    // under test, and deliverShare feature-detects rather than sniffing.
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined,
    });
  });

  async function shareAfterStopping(overrides: Partial<GameServices> = {}) {
    render(<App services={services(overrides)} />);
    await ready();
    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('triangle{Enter}');
    await userEvent.click(screen.getByRole('button', { name: /stop/i }));
    await screen.findByTestId('end-screen');
    await userEvent.click(screen.getByTestId('share-button'));
    await waitFor(() => expect(copied).not.toBe(''));
    return copied;
  }

  it('says the date, and no day number', async () => {
    const text = await shareAfterStopping();
    expect(text).toContain('Out of Sorts · August 1');
    expect(text).not.toMatch(/\bDay\s*\d/i);
  });

  it('still leaks no words from the run', async () => {
    const text = await shareAfterStopping();
    for (const word of WORDS) {
      expect(text.toLowerCase()).not.toContain(word);
    }
  });

  it('an Endless share still reads Endless N', async () => {
    render(<App services={services()} />);
    await ready();
    await userEvent.click(screen.getByRole('button', { name: /endless/i }));
    await waitFor(() => expect(screen.getAllByTestId('pool-tile')).toHaveLength(8));
    await userEvent.click(screen.getByRole('button', { name: /stop/i }));
    await screen.findByTestId('end-screen');
    await userEvent.click(screen.getByTestId('share-button'));
    await waitFor(() => expect(copied).not.toBe(''));
    expect(copied).toContain('Out of Sorts · Endless 1');
    expect(copied).not.toMatch(/August|Day\s*\d/i);
  });

  /**
   * THE MIDNIGHT CASE. A share built from a fresh clock read names whatever
   * day it is NOW, which after rollover is a day whose rack was never
   * played. The date must come from the same place the rack did.
   *
   * The invariant is not that the rack is stable across midnight: `active`
   * re-resolves on the new date and legitimately serves the new rack, and
   * changing that would be rack selection, which is out of scope. It is
   * that the share names the date that selected the rack ON SCREEN.
   */
  it('names the date that selected the rack, across midnight', async () => {
    // 23:58 on August 1 for the whole run. The clock rolls over only once
    // the end screen is up and no further state will change, so `active`
    // does not re-resolve and the rack on screen stays August 1's. A share
    // built from a fresh clock read would now say August 2: a date whose
    // rack this player never saw.
    let clock = new Date(2026, 7, 1, 23, 58);
    render(<App services={services({ now: () => clock })} />);
    await ready();
    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('triangle{Enter}');
    await userEvent.click(screen.getByRole('button', { name: /stop/i }));
    await screen.findByTestId('end-screen');

    clock = new Date(2026, 7, 2, 0, 1);

    await userEvent.click(screen.getByTestId('share-button'));
    await waitFor(() => expect(copied).not.toBe(''));
    expect(copied).toContain('Out of Sorts · August 1');
    expect(copied).not.toContain('August 2');
  });
});

describe('the streak tells the truth on load', () => {
  it('a streak last played today is displayed', async () => {
    render(<App services={services({ storage: storedStreak(3, 0, DAY_ONE) })} />);
    await ready();
    expect(screen.getByTestId('streak').textContent).toContain('3');
  });

  it('a streak last played yesterday is displayed: the day is not over', async () => {
    render(<App services={services({ storage: storedStreak(3, 1, DAY_ONE) })} />);
    await ready();
    expect(screen.getByTestId('streak').textContent).toContain('3');
  });

  it('a streak last played two days ago is gone, not shown as 0', async () => {
    render(<App services={services({ storage: storedStreak(3, 2, DAY_ONE) })} />);
    await ready();
    expect(screen.queryByTestId('streak')).toBeNull();
  });

  it('a streak last played five days ago is gone', async () => {
    render(<App services={services({ storage: storedStreak(3, 5, DAY_ONE) })} />);
    await ready();
    expect(screen.queryByTestId('streak')).toBeNull();
  });

  /**
   * The bug as the player met it: open the game, see Streak 3, play a full
   * run, see Streak 1. The game appeared to punish you for playing. The
   * streak had been dead for days; finishing is what exposed the lie.
   *
   * The load-bearing assertion is on the hook value (game-logic.test.ts).
   * This one pins the rendered consequence: never 3 then 1.
   */
  it('finishing a run never lowers what the header shows', async () => {
    render(<App services={services({ storage: storedStreak(3, 4, DAY_ONE) })} />);
    await ready();
    expect(screen.queryByTestId('streak')).toBeNull();

    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('triangle{Enter}');
    await userEvent.click(screen.getByRole('button', { name: /stop/i }));
    await screen.findByTestId('end-screen');

    // Immediately, with no reload and no second interaction.
    await waitFor(() =>
      expect(screen.getByTestId('streak').textContent).toContain('1'),
    );
    expect(screen.getByTestId('streak').textContent).not.toContain('3');
  });

  it('a live streak climbs when the run ends, with no reload', async () => {
    render(<App services={services({ storage: storedStreak(3, 1, DAY_ONE) })} />);
    await ready();
    expect(screen.getByTestId('streak').textContent).toContain('3');

    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('triangle{Enter}');
    await userEvent.click(screen.getByRole('button', { name: /stop/i }));
    await screen.findByTestId('end-screen');

    await waitFor(() =>
      expect(screen.getByTestId('streak').textContent).toContain('4'),
    );
  });
});
