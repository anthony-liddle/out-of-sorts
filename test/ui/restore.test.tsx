// @vitest-environment jsdom
// Setting the sorts: what a RETURNING player sees before the engine exists.
//
// The flash was never a localStorage race. Progress is read synchronously in
// a lazy initializer and is present on render 1. The flash is the ENGINE:
// `run` needs `puzzle` needs `engine` needs the dictionary, which lands a
// second later off the critical path. Until then the game cannot know the
// player already finished, so it painted a playable board and then yanked
// it; and a mid-run player got the FULL EIGHT LETTER RACK, because the pool
// falls back to the entry's rack when there is no run. That second one is
// worse: it shows letters they no longer own.
//
// The rule this collides with still holds, and it is load-bearing: NO
// SPINNER, THE RACK NEVER WAITS ON THE DICTIONARY, 0 to 2ms to interactive.
// That rule was written for a FRESH rack and it is right for a fresh rack.
// The gate is therefore precise: restored words exist AND the engine is
// null. A fresh rack is never gated, not for a frame. If a test here ever
// blocks a fresh rack, the condition is wrong.
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../src/ui/App';
import { buildDictionaries } from '../../src/engine/dictionary';
import { memoryStorage } from '../../src/game/persistence';
import { silentAudio } from '../../src/ui/audio';
import type { GameServices } from '../../src/ui/services';
import type { KeyValueStorage } from '../../src/game/persistence';
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
  'tan',
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

const CALENDAR: Calendar = {
  epoch: '2026-08-01',
  entries: [
    {
      rack: 'aegilnrt',
      eights: ['relating', 'triangle'],
    },
  ],
};

/** 2026-08-01 is day 1 of this calendar, and the storage day index that
 * `dailyRunKey` derives from it. Hardcoding the key would couple the test to
 * the epoch arithmetic; deriving it is the same thing the app does. */
const NOW = new Date(2026, 7, 1, 10, 0);

const LOADING = /finding what you left/i;

function seeded(snapshots: Record<string, unknown>): KeyValueStorage {
  const storage = memoryStorage();
  for (const [key, value] of Object.entries(snapshots)) {
    storage.setItem(`oos:${key}`, JSON.stringify(value));
  }
  return storage;
}

/** A dictionary that never arrives, so the pre-engine state can be inspected
 * for as long as the test likes. */
function pending() {
  let land!: () => void;
  const dictionaries = new Promise<typeof DICTS>((resolve) => {
    land = () => resolve(DICTS);
  });
  return { loadDictionaries: () => ({ dictionaries }), land };
}

function services(overrides: Partial<GameServices> = {}): GameServices {
  return {
    loadCalendar: async () => CALENDAR,
    loadDictionaries: () => ({ dictionaries: Promise.resolve(DICTS) }),
    storage: memoryStorage(),
    audio: silentAudio,
    now: () => NOW,
    reducedMotionDefault: false,
    ...overrides,
  };
}

// dailyRunKey(NOW): days since STORAGE_EPOCH (2026-01-01) to 2026-08-01.
const DAILY_KEY = 'daily-212';

describe('a fresh rack is never gated', () => {
  it('renders immediately with the dictionary withheld forever, and no loading line', async () => {
    // THE REGRESSION THAT MATTERS MOST. Nothing is saved, so nothing is
    // unknowable, so there is nothing to wait for. This is the whole point
    // of the cold start work and it must survive the fix.
    const { loadDictionaries } = pending();
    render(<App services={services({ loadDictionaries })} />);
    const tiles = await screen.findAllByTestId('pool-tile');
    expect(tiles).toHaveLength(8);
    expect(document.body.textContent).not.toMatch(LOADING);
    expect(document.body.textContent).not.toMatch(/loading/i);
    expect(document.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('shows no spinner or animated indicator anywhere, in any state', () => {
    const { loadDictionaries } = pending();
    render(
      <App
        services={services({
          loadDictionaries,
          storage: seeded({
            [DAILY_KEY]: { rack: 'aegilnrt', words: ['triangle'], stopped: false },
          }),
        })}
      />,
    );
    // A line of text in the game's own face, and then the game.
    expect(document.querySelector('[role="progressbar"]')).toBeNull();
    expect(document.querySelector('.spinner')).toBeNull();
    expect(document.querySelector('svg circle')).toBeNull();
  });
});

describe('a restored run waits, because the game cannot yet tell the truth', () => {
  it('never paints a playable board over a completed daily', async () => {
    // The run is over. Until the engine replays the words the game has no
    // way to know that, and it used to paint a fresh rack and then flip.
    const { loadDictionaries, land } = pending();
    render(
      <App
        services={services({
          loadDictionaries,
          storage: seeded({
            [DAILY_KEY]: {
              rack: 'aegilnrt',
              words: ['triangle', 'tearing', 'rating', 'grain', 'gin'],
              stopped: true,
            },
          }),
        })}
      />,
    );
    expect(await screen.findByTestId('restoring')).toBeTruthy();
    expect(document.body.textContent).toMatch(LOADING);
    // Not one frame of a board they cannot play.
    expect(screen.queryByTestId('pool-tile')).toBeNull();
    expect(screen.queryByTestId('word-display')).toBeNull();
    expect(screen.queryByTestId('control-row')).toBeNull();
    expect(screen.queryByTestId('end-screen')).toBeNull();

    land();
    expect(await screen.findByTestId('end-screen')).toBeTruthy();
    expect(screen.queryByTestId('restoring')).toBeNull();
    expect(document.body.textContent).not.toMatch(LOADING);
  });

  it('never shows a mid-run player the eight letters they no longer own', async () => {
    // The worse case. TRIANGLE was played, so the pool is its five letters
    // and three tiles are gone. The old code fell back to the entry's RACK
    // and showed all eight.
    const { loadDictionaries, land } = pending();
    render(
      <App
        services={services({
          loadDictionaries,
          storage: seeded({
            [DAILY_KEY]: {
              rack: 'aegilnrt',
              words: ['triangle', 'tearing', 'grain'],
              stopped: false,
            },
          }),
        })}
      />,
    );
    expect(await screen.findByTestId('restoring')).toBeTruthy();
    expect(screen.queryAllByTestId('pool-tile')).toHaveLength(0);

    land();
    // When the pool finally appears it is the RESTORED pool, and it never
    // was the rack: GRAIN's five letters, not the rack's eight.
    await waitFor(() =>
      expect(screen.getAllByTestId('pool-tile')).toHaveLength(5),
    );
    const letters = screen
      .getAllByTestId('pool-tile')
      .map((t) => t.textContent?.trim().toLowerCase())
      .sort()
      .join('');
    expect(letters).toBe('aginr');
    expect(screen.getAllByTestId('stack-row')).toHaveLength(3);
  });

  it('gates everything derived from the run, not merely the board', async () => {
    // The stack, the drift and the running score are all derived from the
    // run. A restored player must not watch them pop in one by one.
    const { loadDictionaries } = pending();
    render(
      <App
        services={services({
          loadDictionaries,
          storage: seeded({
            [DAILY_KEY]: {
              rack: 'aegilnrt',
              words: ['triangle'],
              stopped: false,
            },
          }),
        })}
      />,
    );
    await screen.findByTestId('restoring');
    expect(screen.queryByTestId('stack')).toBeNull();
    expect(screen.queryByTestId('drift')).toBeNull();
    expect(screen.queryByTestId('running-score')).toBeNull();
    expect(screen.queryByTestId('stack-waiting')).toBeNull();
  });

  it('waits for a run the player stopped without playing a word', async () => {
    // Zero words, but stopped: the run is over and the end screen is the
    // truth. Gating on words alone would flash a board here too.
    const { loadDictionaries, land } = pending();
    render(
      <App
        services={services({
          loadDictionaries,
          storage: seeded({
            [DAILY_KEY]: { rack: 'aegilnrt', words: [], stopped: true },
          }),
        })}
      />,
    );
    expect(await screen.findByTestId('restoring')).toBeTruthy();
    expect(screen.queryByTestId('pool-tile')).toBeNull();
    land();
    expect(await screen.findByTestId('end-screen')).toBeTruthy();
  });
});

describe('daily and endless gate independently', () => {
  it('a restored daily never blocks a fresh endless', async () => {
    const { loadDictionaries } = pending();
    const { default: userEvent } = await import('@testing-library/user-event');
    render(
      <App
        services={services({
          loadDictionaries,
          storage: seeded({
            [DAILY_KEY]: {
              rack: 'aegilnrt',
              words: ['triangle'],
              stopped: false,
            },
          }),
        })}
      />,
    );
    // Daily is restoring.
    expect(await screen.findByTestId('restoring')).toBeTruthy();

    // Endless has nothing saved, so it is a fresh rack and it owes no wait,
    // dictionary or no dictionary.
    await userEvent.click(screen.getByRole('button', { name: /endless/i }));
    await waitFor(() =>
      expect(screen.getAllByTestId('pool-tile')).toHaveLength(8),
    );
    expect(document.body.textContent).not.toMatch(LOADING);

    // And going back to the daily still tells the truth about the daily.
    await userEvent.click(screen.getByRole('button', { name: /daily/i }));
    expect(await screen.findByTestId('restoring')).toBeTruthy();
  });

  it('a restored endless waits on its own account', async () => {
    const { loadDictionaries } = pending();
    const { default: userEvent } = await import('@testing-library/user-event');
    render(
      <App
        services={services({
          loadDictionaries,
          storage: seeded({
            'endless-current': {
              rack: 'aegilnrt',
              words: ['triangle'],
              stopped: false,
              endlessSeed: 0,
            },
          }),
        })}
      />,
    );
    // The daily is fresh: it renders at once.
    await screen.findAllByTestId('pool-tile');
    expect(document.body.textContent).not.toMatch(LOADING);

    await userEvent.click(screen.getByRole('button', { name: /endless/i }));
    expect(await screen.findByTestId('restoring')).toBeTruthy();
    expect(screen.queryByTestId('pool-tile')).toBeNull();
  });
});
