// @vitest-environment jsdom
// The furniture: the footer that says who made this and why, and the how
// it works page, because the rules of this game are genuinely unusual and
// there was nowhere to learn them.
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../src/ui/App';
import { buildDictionaries } from '../../src/engine/dictionary';
import { memoryStorage } from '../../src/game/persistence';
import { silentAudio } from '../../src/ui/audio';
import type { GameServices } from '../../src/ui/services';
import type { Calendar } from '../../src/calendar/types';

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

const WORDS = ['triangle', 'tearing', 'rating', 'grain', 'tan'];
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
  entries: [{ rack: 'aegilnrt', eights: ['triangle'] }],
};

function services(): GameServices {
  return {
    loadCalendar: async () => CALENDAR,
    loadDictionaries: () => ({ dictionaries: Promise.resolve(DICTS) }),
    storage: memoryStorage(),
    audio: silentAudio,
    now: () => new Date(2026, 7, 1, 10, 0),
    reducedMotionDefault: false,
  };
}

async function ready() {
  await waitFor(() =>
    expect(document.querySelector('[data-ready="true"]')).toBeTruthy(),
  );
}

function openHow() {
  window.location.hash = '#how';
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

describe('the footer', () => {
  it('says who validated the words and what the game is set in', async () => {
    render(<App services={services()} />);
    await ready();
    const footer = screen.getByRole('contentinfo');
    expect(footer.textContent).toMatch(/ENABLE/);
    expect(footer.textContent).toMatch(/SCOWL/);
    expect(footer.textContent).toMatch(/public domain/i);
    expect(footer.textContent).toMatch(/Baloo 2/);
    expect(footer.textContent).toMatch(/Nunito/);
  });

  it('offers a how it works link that goes somewhere real', async () => {
    render(<App services={services()} />);
    await ready();
    const link = screen.getByRole('link', { name: /how it works/i });
    expect(link.getAttribute('href')).toBe('#how');
  });

  it('holds a place for the dedication without writing it', async () => {
    // The line is Antoine's to write, not ours. The slot exists, empty.
    render(<App services={services()} />);
    await ready();
    expect(screen.getByTestId('dedication').textContent).toBe('');
  });
});

describe('how it works', () => {
  it('opens on its hash, tells the rules in the voice, and offers a way back', async () => {
    render(<App services={services()} />);
    await ready();
    openHow();
    const page = await screen.findByTestId('how-it-works');
    expect(page.textContent).toMatch(/eight letters/i);
    expect(page.textContent).toMatch(/every letter you don't use is gone/i);
    expect(page.textContent).toMatch(/no word twice/i);
    expect(page.textContent).toMatch(/out of sorts/i);
    // the reveal stays the end screen's: the rules never mention par
    expect(page.textContent).not.toMatch(/\bpar\b/i);
    expect(screen.getByRole('link', { name: /back/i })).toBeTruthy();
    // the board is not competing with the page
    expect(screen.queryByTestId('pool')).toBeNull();
  });

  it('does not let the rules page eat keystrokes meant for nothing', async () => {
    // The global capture is for play. While the rules are open there is no
    // board, and typing must not build an invisible word behind the page.
    render(<App services={services()} />);
    await ready();
    openHow();
    await screen.findByTestId('how-it-works');
    await userEvent.keyboard('tan');
    window.location.hash = '';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await waitFor(() => expect(screen.queryByTestId('pool')).toBeTruthy());
    expect(screen.getByTestId('word-display').textContent).not.toContain(
      'TAN',
    );
  });
});
