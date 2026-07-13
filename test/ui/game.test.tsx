// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

describe('tile selection with duplicate letters', () => {
  // Rack of DISSUADE: two S tiles, two D tiles. Clicking a specific tile
  // must light that tile, and a one letter input must not chill the board:
  // below three letters no playable word exists, so there is no discard
  // set to preview yet.
  const DUP_CALENDAR: Calendar = {
    epoch: '2026-08-01',
    entries: [{ rack: 'addeissu', eights: ['dissuade'] }],
  }

  function dupServices(): GameServices {
    return services({
      loadCalendar: async () => DUP_CALENDAR,
      loadDictionaries: () => ({
        dictionaries: new Promise<never>(() => {}) as never,
      }),
    })
  }

  it('clicking a specific duplicate tile marks that tile, not the first match', async () => {
    render(<App services={dupServices()} />)
    await screen.findAllByTestId('pool-tile')
    const esses = screen
      .getAllByTestId('pool-tile')
      .filter((t) => t.textContent === 'S')
    expect(esses).toHaveLength(2)
    await userEvent.click(esses[1]!)
    expect(esses[1]!.dataset.state).toBe('used')
    expect(esses[0]!.dataset.state).toBeUndefined()
  })

  it('a one or two letter input marks used tiles but chills nothing', async () => {
    render(<App services={dupServices()} />)
    await screen.findAllByTestId('pool-tile')
    const input = screen.getByLabelText<HTMLInputElement>(/type a word/i)
    await userEvent.type(input, 'du')
    const tiles = screen.getAllByTestId('pool-tile')
    expect(tiles.filter((t) => t.dataset.state === 'cold')).toHaveLength(0)
    expect(tiles.filter((t) => t.dataset.state === 'used')).toHaveLength(2)
    await userEvent.type(input, 'e')
    expect(
      screen
        .getAllByTestId('pool-tile')
        .filter((t) => t.dataset.state === 'cold'),
    ).toHaveLength(5)
  })

  it('typing after clicking keeps the clicked tile lit', async () => {
    render(<App services={dupServices()} />)
    await screen.findAllByTestId('pool-tile')
    const esses = screen
      .getAllByTestId('pool-tile')
      .filter((t) => t.textContent === 'S')
    await userEvent.click(esses[1]!)
    const input = screen.getByLabelText<HTMLInputElement>(/type a word/i)
    await userEvent.type(input, 'id')
    expect(esses[1]!.dataset.state).toBe('used')
    // three letters typed: the preview is live and the unclicked S is cold,
    // but the light never jumps to it
    expect(esses[0]!.dataset.state).toBe('cold')
  })

  it('clicking a used tile does not consume a second copy', async () => {
    render(<App services={dupServices()} />)
    await screen.findAllByTestId('pool-tile')
    const [a] = screen
      .getAllByTestId('pool-tile')
      .filter((t) => t.textContent === 'A')
    await userEvent.click(a!)
    await userEvent.click(a!)
    const input = screen.getByLabelText<HTMLInputElement>(/type a word/i)
    expect(input.value.toLowerCase()).toBe('a')
  })
})

describe('the cold tile preview', () => {
  it('a cold tile is still tappable: tapping un-chills it and spends it', async () => {
    render(<App services={services()} />)
    await ready()
    const input = screen.getByLabelText<HTMLInputElement>(/type a word/i)
    await userEvent.type(input, 'tea')
    const cold = screen
      .getAllByTestId('pool-tile')
      .find((t) => t.dataset.state === 'cold' && t.textContent === 'L')
    expect(cold).toBeTruthy()
    await userEvent.click(cold!)
    expect(input.value.toLowerCase()).toBe('teal')
    expect(cold!.dataset.state).toBe('used')
  })


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
        played={[{ word: 'angriest', score: 9, length: 8 }]}
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

describe('voice and the vertical', () => {
  it('shows the tagline and an empty drift before anything is lost', async () => {
    render(<App services={services()} />)
    await ready()
    expect(
      screen.getByText(/every letter you don't use is gone/i),
    ).toBeTruthy()
    expect(screen.getByText(/nothing lost yet/i)).toBeTruthy()
  })

  it('the submit button says spend', async () => {
    render(<App services={services()} />)
    await ready()
    expect(screen.getByRole('button', { name: /spend/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^play$/i })).toBeNull()
  })

  it('lays the board out as drift above pool above stack', async () => {
    render(<App services={services()} />)
    await ready()
    await playWord('triangle')
    await playWord('tearing')
    const drift = screen.getByTestId('drift')
    const pool = screen.getByTestId('pool')
    const stack = screen.getByTestId('stack')
    const order = drift.compareDocumentPosition(pool)
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(
      pool.compareDocumentPosition(stack) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('a clean finish says out of sorts, a stopped run says rested early', async () => {
    const shared = services()
    const view = render(<App services={shared} />)
    await ready()
    for (const w of [
      'triangle',
      'tearing',
      'rating',
      'grain',
      'grin',
      'ring',
      'gin',
    ]) {
      await playWord(w)
    }
    const heading = await screen.findByRole('heading', { level: 2 })
    expect(heading.textContent).toBe('Out of sorts.')
    expect(screen.queryByText(/rested early/i)).toBeNull()
    view.unmount()

    const stoppedServices = services({ storage: memoryStorage() })
    render(<App services={stoppedServices} />)
    await ready()
    await playWord('triangle')
    await userEvent.click(screen.getByRole('button', { name: /stop/i }))
    const stoppedHeading = await screen.findByRole('heading', { level: 2 })
    expect(stoppedHeading.textContent).toBe('Rested early.')
  })

  it('renders the par path as a ghosted stack on the end screen', async () => {
    render(<App services={services()} />)
    await ready()
    await playWord('triangle')
    await userEvent.click(screen.getByRole('button', { name: /stop/i }))
    await screen.findByTestId('end-screen')
    const parStack = screen.getByTestId('par-stack')
    expect(parStack.querySelectorAll('[data-testid="stack-row"]').length)
      .toBeGreaterThan(1)
    expect(document.body.textContent).not.toContain(' > ')
  })

  it('the oldest ghost renders faintest, straight from the play index', async () => {
    render(<App services={services()} />)
    await ready()
    await playWord('triangle')
    await playWord('tearing')
    await playWord('rating')
    await playWord('grain')
    // four plays spend three letters: the first play spends nothing
    const ghosts = screen.getAllByTestId('ghost')
    expect(ghosts.length).toBe(3)
    const byIndex = [...ghosts].sort(
      (a, b) => Number(a.dataset.playIndex) - Number(b.dataset.playIndex),
    )
    const oldest = Number(byIndex[0]!.style.opacity || 1)
    const newest = Number(byIndex[byIndex.length - 1]!.style.opacity || 1)
    expect(oldest).toBeLessThan(newest)
  })

  it('marks no notch with an accent color, only the width gap', async () => {
    render(<App services={services()} />)
    await ready()
    await playWord('triangle')
    await playWord('rating')
    const rows = screen.getAllByTestId('stack-row')
    const notchRow = rows.find((r) => r.dataset.notch)
    expect(notchRow).toBeTruthy()
    expect(notchRow!.querySelector('.notch')).toBeNull()
    // Width is a pure function of word length in every stack: one shared
    // unit per letter, so the same word is the same width in every column.
    // The real pixel widths are measured in test/layout.test.ts, because
    // jsdom has no layout engine.
    expect(notchRow!.style.width).toBe('calc(6 * var(--stack-unit))')
    expect(rows[0]!.style.width).toBe('calc(8 * var(--stack-unit))')
  })

  it('hides the sound toggle while keeping audio behind its interface', async () => {
    render(<App services={services()} />)
    await ready()
    expect(screen.queryByRole('button', { name: /sound/i })).toBeNull()
  })
})

describe('hands: the control row', () => {
  it('offers shuffle, clear, backspace, and spend under the pool', async () => {
    render(<App services={services()} />)
    await ready()
    const row = screen.getByTestId('control-row')
    const labels = [...row.querySelectorAll('button')].map(
      (b) => b.getAttribute('aria-label') ?? b.textContent,
    )
    expect(labels).toEqual(['Shuffle', 'Clear', 'Delete last letter', 'Spend'])
  })

  it('keeps stop away from spend', async () => {
    render(<App services={services()} />)
    await ready()
    const spend = screen.getByRole('button', { name: /spend/i })
    const stop = screen.getByRole('button', { name: /stop/i })
    expect(stop.parentElement).not.toBe(spend.parentElement)
    // spend must come first in DOM order, with distance between them
    expect(
      spend.compareDocumentPosition(stop) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('backspace and clear keep the input and tile states in sync', async () => {
    render(<App services={services()} />)
    await ready()
    const input = screen.getByLabelText<HTMLInputElement>(/type a word/i)
    await userEvent.type(input, 'rating')
    expect(
      screen.getAllByTestId('pool-tile').filter((t) => t.dataset.state === 'used'),
    ).toHaveLength(6)
    await userEvent.click(
      screen.getByRole('button', { name: /delete last letter/i }),
    )
    expect(input.value.toLowerCase()).toBe('ratin')
    expect(
      screen.getAllByTestId('pool-tile').filter((t) => t.dataset.state === 'used'),
    ).toHaveLength(5)
    await userEvent.click(screen.getByRole('button', { name: /clear/i }))
    expect(input.value).toBe('')
    expect(
      screen.getAllByTestId('pool-tile').every((t) => !t.dataset.state),
    ).toBe(true)
  })

  it('shuffle rearranges the pool without ever spelling a valid word', async () => {
    render(<App services={services()} />)
    await ready()
    // descend to the four letter pool of GRIN, where RING also lurks
    for (const w of ['triangle', 'tearing', 'rating', 'grain', 'grin']) {
      await playWord(w)
    }
    for (let i = 0; i < 20; i++) {
      const display = screen
        .getAllByTestId('pool-tile')
        .map((t) => t.textContent)
        .join('')
        .toLowerCase()
      expect(['grin', 'ring']).not.toContain(display)
      await userEvent.click(screen.getByRole('button', { name: /shuffle/i }))
    }
  })

  it('the pool after a drop never spells a valid word', async () => {
    // The live bug this build fixes: the redisplay guard only knew the
    // just played word and the baked eights. GIN's pool letters can spell
    // nothing here, but GRIN's can spell RING, and the display must not.
    render(<App services={services()} />)
    await ready()
    await playWord('triangle')
    await playWord('rating')
    await playWord('grain')
    await playWord('ring')
    const display = screen
      .getAllByTestId('pool-tile')
      .map((t) => t.textContent)
      .join('')
      .toLowerCase()
    expect(['ring', 'grin']).not.toContain(display)
  })

  it('shuffle keeps the typed input and remaps the tile lights', async () => {
    render(<App services={services()} />)
    await ready()
    const input = screen.getByLabelText<HTMLInputElement>(/type a word/i)
    await userEvent.type(input, 'grin')
    await userEvent.click(screen.getByRole('button', { name: /shuffle/i }))
    expect(input.value.toLowerCase()).toBe('grin')
    expect(
      screen.getAllByTestId('pool-tile').filter((t) => t.dataset.state === 'used'),
    ).toHaveLength(4)
  })
})

describe('face: the end screen explains the day', () => {
  it('says there was no choice on a rack whose best path is clean, with no toggle', async () => {
    render(<App services={services()} />)
    await ready()
    await playWord('triangle')
    await userEvent.click(screen.getByRole('button', { name: /stop/i }))
    await screen.findByTestId('end-screen')
    expect(
      screen.getByText(/the best path was also a clean one/i),
    ).toBeTruthy()
    expect(screen.queryByText(/no choice to make today/i)).toBeNull()
    expect(screen.queryByTestId('clean-stack')).toBeNull()
    expect(screen.getByText(/^best · \d+$/i)).toBeTruthy()
  })

  it('reports the engine-computed gap in plain words from the screen', () => {
    const dicts = realDicts()
    const engine = createEngine(dicts)
    const puzzle = engine.createPuzzle('addeissu')
    expect(puzzle.bestClean).not.toBeNull()
    expect(puzzle.par).not.toBe(puzzle.bestClean)
    const gap = puzzle.par - puzzle.bestClean!
    render(
      <EndScreen
        puzzle={puzzle}
        result={{
          score: 20,
          words: [],
          endReason: 'stopped',
          finalPoolSize: 4,
          isCleanDescent: false,
        }}
        played={[{ word: 'dissuade', score: 10, length: 8 }]}
        dayLabel="Day 1"
        onShare={() => {}}
        onNewEndless={null}
      />,
    )
    expect(
      screen.getByText(/clean descent wasn't on the best path today/i),
    ).toBeTruthy()
    expect(
      screen.getByText(
        new RegExp(`would have cost you ${gap} of ${puzzle.par} points`),
      ),
    ).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/greed|discipline/i)
    expect(screen.getByTestId('clean-stack')).toBeTruthy()
    // definitions live in the sentence, not the headers: headers are
    // name and number only, so the stacks share a baseline
    expect(screen.getByText(`Best · ${puzzle.par}`)).toBeTruthy()
    expect(screen.getByText(`Clean · ${puzzle.bestClean}`)).toBeTruthy()
    expect(
      screen.queryByText(/most points possible/i),
    ).toBeNull()
  })
})

describe('a daily that does not exist', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('says so rather than serving a plausible wrong rack', async () => {
    // In dev this throws, which is the point: a future epoch must be
    // impossible to miss. In production it surfaces a true message instead
    // of a plausible wrong rack, and that is the path under test here.
    vi.stubEnv('DEV', false)
    // The original bug: the epoch sat in the future, rackForDate returned
    // null every day, and the UI clamped to entry 0. It looked like a
    // working game and the daily never rolled over.
    const future: Calendar = {
      epoch: '2099-01-01',
      entries: CALENDAR.entries,
    }
    render(
      <App services={services({ loadCalendar: async () => future })} />,
    )
    expect(await screen.findByTestId('no-daily')).toBeTruthy()
    expect(screen.getByText(/no puzzle today/i)).toBeTruthy()
    expect(screen.queryAllByTestId('pool-tile')).toHaveLength(0)

    // and endless still works
    await userEvent.click(
      screen.getByRole('button', { name: /play endless/i }),
    )
    expect(await screen.findAllByTestId('pool-tile')).toHaveLength(8)
  })

  it('throws in dev, so a future epoch cannot be missed', async () => {
    vi.stubEnv('DEV', true)
    const errors: unknown[] = []
    const onError = (e: ErrorEvent) => {
      errors.push(e.error)
      e.preventDefault()
    }
    window.addEventListener('error', onError)
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      render(
        <App
          services={services({
            loadCalendar: async () => ({
              epoch: '2099-01-01',
              entries: CALENDAR.entries,
            }),
          })}
        />,
      )
      await waitFor(() => expect(errors.length).toBeGreaterThan(0))
      expect(String(errors[0])).toMatch(/epoch .* is in the future/i)
    } finally {
      window.removeEventListener('error', onError)
      spy.mockRestore()
    }
  })
})

describe('the empty yours column', () => {
  it('renders a sentence, not a blank, when nothing was spent', () => {
    const dicts = realDicts()
    const engine = createEngine(dicts)
    const puzzle = engine.createPuzzle('addeissu')
    render(
      <EndScreen
        puzzle={puzzle}
        result={{
          score: 0,
          words: [],
          endReason: 'stopped',
          finalPoolSize: 8,
          isCleanDescent: false,
        }}
        played={[]}
        dayLabel="Day 1"
        onShare={() => {}}
        onNewEndless={null}
      />,
    )
    expect(screen.getByText(/you spent nothing/i)).toBeTruthy()
    expect(
      screen
        .getByTestId('your-stack-figure')
        .querySelectorAll('[data-testid="stack-row"]'),
    ).toHaveLength(0)
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
