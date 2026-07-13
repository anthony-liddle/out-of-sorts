// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../../src/ui/App'
import { EndScreen } from '../../src/ui/components/EndScreen'
import { buildDictionaries } from '../../src/engine/dictionary'
import { createEngine } from '../../src/engine/engine'
import { memoryStorage } from '../../src/game/persistence'
import { silentAudio } from '../../src/ui/audio'
import type { GameServices } from '../../src/ui/services'
import type { Calendar } from '../../src/calendar/types'
import { realDicts } from '../helpers/dicts'

afterEach(cleanup)

// Synthetic language over the rack AEGILNRT. Four common eights, a clean
// ladder to three, and a small mill at the bottom.
const WORDS = [
  'triangle', 'relating', 'alerting', 'integral',
  'tearing', 'rating', 'grain', 'grin', 'ring', 'gain',
  'gin', 'rig', 'nag', 'tan', 'ant',
]
const SYNTH_DICTS = buildDictionaries({
  enable: WORDS,
  scowl95Extra: [],
  allow: [],
  deny: [],
  common: WORDS,
  source: [],
})
// A variant where only TRIANGLE is a common eight; the other three are
// boundary-only (off-pool eights).
const SINGLE_EIGHT_DICTS = buildDictionaries({
  enable: WORDS,
  scowl95Extra: [],
  allow: [],
  deny: [],
  common: WORDS.filter(
    (w) => !['relating', 'alerting', 'integral'].includes(w),
  ),
  source: [],
})

const CALENDAR: Calendar = {
  epoch: '2026-08-01',
  entries: [
    {
      rack: 'aegilnrt',
      eights: ['alerting', 'integral', 'relating', 'triangle'],
    },
  ],
}

function services(overrides: Partial<GameServices> = {}): GameServices {
  return {
    loadCalendar: async () => CALENDAR,
    loadDictionaries: () => ({
      dictionaries: Promise.resolve(SYNTH_DICTS),
    }),
    storage: memoryStorage(),
    audio: silentAudio,
    now: () => new Date(2026, 7, 1, 10, 0),
    reducedMotionDefault: false,
    ...overrides,
  }
}

async function ready() {
  await waitFor(() =>
    expect(document.querySelector('[data-ready="true"]')).toBeTruthy(),
  )
}

async function playWord(word: string) {
  const input = screen.getByLabelText<HTMLInputElement>(/type a word/i)
  await userEvent.clear(input)
  await userEvent.type(input, `${word}{Enter}`)
}

describe('cold start in the UI', () => {
  it('renders the rack with no dictionary, fast, with no spinner', async () => {
    const never = new Promise<never>(() => {})
    const t0 = performance.now()
    render(
      <App
        services={services({
          loadDictionaries: () => ({ dictionaries: never as never }),
        })}
      />,
    )
    const tiles = await screen.findAllByTestId('pool-tile')
    expect(performance.now() - t0).toBeLessThan(100)
    expect(tiles).toHaveLength(8)
    expect(document.body.textContent).not.toMatch(/loading/i)
    expect(document.querySelector('[role="progressbar"]')).toBeNull()
  })

  it('queues a submit made before the dictionary lands and resolves it', async () => {
    let resolveDicts!: (d: typeof SYNTH_DICTS) => void
    render(
      <App
        services={services({
          loadDictionaries: () => ({
            dictionaries: new Promise((r) => (resolveDicts = r)),
          }),
        })}
      />,
    )
    await screen.findAllByTestId('pool-tile')
    await playWord('triangle')
    expect(screen.queryByTestId('stack-row')).toBeNull()
    resolveDicts(SYNTH_DICTS)
    await waitFor(() =>
      expect(screen.getAllByTestId('stack-row')).toHaveLength(1),
    )
  })
})

describe('the cold tile preview', () => {
  it('marks exactly the letters the current input would discard', async () => {
    render(<App services={services()} />)
    await ready()
    const input = screen.getByLabelText<HTMLInputElement>(/type a word/i)
    await userEvent.type(input, 'tearing')
    const tiles = screen.getAllByTestId('pool-tile')
    const cold = tiles.filter((t) => t.dataset.state === 'cold')
    expect(cold.map((t) => t.textContent)).toEqual(['L'])
    expect(
      tiles.filter((t) => t.dataset.state === 'used'),
    ).toHaveLength(7)
    await userEvent.clear(input)
    expect(
      screen.getAllByTestId('pool-tile').every((t) => !t.dataset.state),
    ).toBe(true)
  })
})

describe('playing words', () => {
  it('moves discarded letters to the spent row with the play index', async () => {
    render(<App services={services()} />)
    await ready()
    await playWord('triangle')
    expect(screen.queryAllByTestId('ghost')).toHaveLength(0)
    await playWord('tearing')
    const ghosts = screen.getAllByTestId('ghost')
    expect(ghosts).toHaveLength(1)
    expect(ghosts[0]!.textContent).toContain('L')
    expect(ghosts[0]!.dataset.playIndex).toBe('1')
  })

  it('never shows the eight count during play', async () => {
    render(<App services={services()} />)
    await ready()
    await playWord('triangle')
    expect(screen.queryByTestId('eight-count')).toBeNull()
    expect(document.body.textContent).not.toMatch(/[0-9]+ eights/i)
  })
})

describe('the all eights badge', () => {
  const dicts = realDicts()

  it('counts common pool eights, never boundary eights: aeginrst is 5, not 12', () => {
    const engine = createEngine(dicts)
    const puzzle = engine.createPuzzle('aeginrst')
    expect(puzzle.holds.fullRackWords).toHaveLength(5)
    // the baked boundary list for this rack carries 12; the badge must not
    const run = { score: 45, words: [], endReason: 'stopped' as const,
      finalPoolSize: 8, isCleanDescent: false }
    render(
      <EndScreen
        puzzle={puzzle}
        result={run}
        playedWords={['angriest']}
        dayLabel="Day 1"
        onShare={() => {}}
        onNewEndless={null}
      />,
    )
    const badge = screen.getByTestId('badge-all-eights')
    expect(badge.textContent).toContain('1/5')
    expect(badge.textContent).not.toContain('12')
  })

  it('does not render at all on a single-eight rack', async () => {
    render(
      <App
        services={services({
          loadDictionaries: () => ({
            dictionaries: Promise.resolve(SINGLE_EIGHT_DICTS),
          }),
        })}
      />,
    )
    await ready()
    await playWord('triangle')
    await userEvent.click(screen.getByRole('button', { name: /stop/i }))
    await screen.findByTestId('end-screen')
    expect(screen.queryByTestId('badge-all-eights')).toBeNull()
    expect(screen.getByTestId('badge-clean')).toBeTruthy()
  })
})

describe('daily and endless', () => {
  it('persist independently, switching resets neither, reload preserves both', async () => {
    const shared = services()
    const view = render(<App services={shared} />)
    await ready()
    await playWord('triangle')
    expect(screen.getAllByTestId('stack-row')).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: /endless/i }))
    await ready()
    await playWord('relating')
    expect(screen.getAllByTestId('stack-row')).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: /daily/i }))
    await ready()
    expect(screen.getAllByTestId('stack-row')).toHaveLength(1)

    view.unmount()
    render(<App services={shared} />)
    await ready()
    expect(screen.getAllByTestId('stack-row')).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: /endless/i }))
    await ready()
    expect(screen.getAllByTestId('stack-row')).toHaveLength(1)
  })

  it('endless never advances the streak', async () => {
    const shared = services()
    render(<App services={shared} />)
    await ready()
    await userEvent.click(screen.getByRole('button', { name: /endless/i }))
    await ready()
    await playWord('triangle')
    await userEvent.click(screen.getByRole('button', { name: /stop/i }))
    await screen.findByTestId('end-screen')
    expect(shared.storage.getItem('oos:streak')).toBeNull()
  })
})

describe('reduced motion', () => {
  it('suppresses drift and decay while the spent row stays readable', async () => {
    render(<App services={services({ reducedMotionDefault: true })} />)
    await ready()
    await playWord('triangle')
    await playWord('tearing')
    const ghost = screen.getAllByTestId('ghost')[0]!
    expect(ghost.dataset.motion).toBe('off')
    expect(ghost.textContent).toContain('L')
    const opacity = ghost.style.opacity
    expect(opacity === '' || Number(opacity) === 1).toBe(true)
  })
})
