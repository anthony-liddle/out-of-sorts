// @vitest-environment jsdom
// The haunting in the App: ghosts scatter out of the tidy row and into the
// margins. jsdom has no layout engine, so everything positional here is
// about determinism and data flow; the real rects are measured in
// test/layout.test.ts.
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../src/ui/App';
import { buildDictionaries } from '../../src/engine/dictionary';
import { memoryStorage } from '../../src/game/persistence';
import { silentAudio } from '../../src/ui/audio';
import type { GameServices } from '../../src/ui/services';
import type { Calendar } from '../../src/calendar/types';

afterEach(cleanup);

// The synthetic language over AEGILNRT used across the UI tests.
const WORDS = [
  'triangle',
  'relating',
  'alerting',
  'integral',
  'tearing',
  'rating',
  'grain',
  'grin',
  'ring',
  'gain',
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
      eights: ['alerting', 'integral', 'relating', 'triangle'],
    },
  ],
};

function services(overrides: Partial<GameServices> = {}): GameServices {
  return {
    loadCalendar: async () => CALENDAR,
    loadDictionaries: () => ({ dictionaries: Promise.resolve(DICTS) }),
    storage: memoryStorage(),
    audio: silentAudio,
    now: () => new Date(2026, 7, 1, 10, 0),
    reducedMotionDefault: false,
    ...overrides,
  };
}

async function ready() {
  await waitFor(() =>
    expect(document.querySelector('[data-ready="true"]')).toBeTruthy(),
  );
}

async function playWord(word: string) {
  await userEvent.keyboard('{Escape}');
  await userEvent.keyboard(`${word}{Enter}`);
}

function ghosts(): HTMLElement[] {
  return screen.queryAllByTestId('ghost');
}

describe('the ghost count is the spent count, exactly', () => {
  it('tracks every drop and nothing else', async () => {
    render(<App services={services()} />);
    await ready();
    expect(ghosts()).toHaveLength(0);
    await playWord('triangle'); // full rack: spends nothing
    expect(ghosts()).toHaveLength(0);
    await playWord('tearing'); // drops the L
    expect(ghosts()).toHaveLength(1);
    await playWord('rating'); // drops the E
    expect(ghosts()).toHaveLength(2);
    await playWord('grain'); // drops the T
    expect(ghosts()).toHaveLength(3);
    // a rejected word spends nothing
    await playWord('xyz');
    expect(ghosts()).toHaveLength(3);
  });
});

describe('the haunt is deterministic across mounts', () => {
  it('renders the same run at the same positions after a remount', async () => {
    const shared = services();
    const view = render(<App services={shared} />);
    await ready();
    await playWord('triangle');
    await playWord('tearing');
    await playWord('rating');
    const before = ghosts().map((g) => ({
      letter: g.textContent,
      transform: g.style.transform,
    }));
    expect(before).toHaveLength(2);
    for (const g of before) expect(g.transform).toMatch(/translate/);
    view.unmount();

    render(<App services={shared} />);
    await ready();
    await waitFor(() => expect(ghosts()).toHaveLength(2));
    const after = ghosts().map((g) => ({
      letter: g.textContent,
      transform: g.style.transform,
    }));
    expect(after).toEqual(before);
  });
});

describe('the arrival belongs to the play, not the reload', () => {
  it('marks only the newest ghosts as arriving, and none after a remount', async () => {
    const shared = services();
    const view = render(<App services={shared} />);
    await ready();
    await playWord('triangle');
    await playWord('tearing');
    expect(ghosts()[0]!.hasAttribute('data-arriving')).toBe(true);
    await playWord('rating');
    const byPlay = ghosts();
    const newest = byPlay.filter((g) => g.dataset.playIndex === '2');
    const older = byPlay.filter((g) => g.dataset.playIndex !== '2');
    for (const g of newest) expect(g.hasAttribute('data-arriving')).toBe(true);
    for (const g of older) expect(g.hasAttribute('data-arriving')).toBe(false);
    view.unmount();

    render(<App services={shared} />);
    await ready();
    await waitFor(() => expect(ghosts()).toHaveLength(2));
    for (const g of ghosts()) {
      expect(g.hasAttribute('data-arriving')).toBe(false);
    }
  });
});

describe('twins read as twins', () => {
  it('renders ghosts of one play at the same size and the same opacity', async () => {
    render(<App services={services()} />);
    await ready();
    await playWord('triangle');
    await playWord('rating'); // drops E and L together: twins
    const twins = ghosts().filter((g) => g.dataset.playIndex === '1');
    expect(twins).toHaveLength(2);
    const [a, b] = twins;
    expect(a!.style.opacity).toBe(b!.style.opacity);
    const scaleOf = (el: HTMLElement) =>
      el.style.transform.match(/scale\(([^)]+)\)/)?.[1];
    expect(scaleOf(a!)).toBeDefined();
    expect(scaleOf(a!)).toBe(scaleOf(b!));
  });
});

describe('reduced motion keeps the facts', () => {
  it('holds every ghost still at its position and its aged opacity', async () => {
    render(<App services={services({ reducedMotionDefault: true })} />);
    await ready();
    await playWord('triangle');
    await playWord('tearing');
    await playWord('rating');
    const spirits = ghosts();
    expect(spirits).toHaveLength(2);
    const opacities = spirits
      .sort((a, b) => Number(a.dataset.playIndex) - Number(b.dataset.playIndex))
      .map((g) => Number(g.style.opacity));
    // the fade survives: older fainter, and nobody is reset to full
    expect(opacities[0]!).toBeGreaterThan(0.1);
    expect(opacities[0]!).toBeLessThan(opacities[1]!);
    expect(opacities[1]!).toBeLessThan(1);
    for (const g of spirits) {
      expect(g.dataset.motion).toBe('off');
      expect(g.style.transform).toMatch(/translate/);
      expect(g.hasAttribute('data-arriving')).toBe(false);
    }
  });
});
