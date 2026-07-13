import { useMemo, useState } from 'react'
import { rankFor } from '../game/rank'
import { buildShare } from '../game/share'
import { Drift } from './components/Drift'
import { EndScreen } from './components/EndScreen'
import { Pool, reconcileSelection } from './components/Pool'
import { Stack } from './components/Stack'
import type { GameServices } from './services'
import { useGame } from './useGame'
import './theme.css'

export function App({ services }: { services: GameServices }) {
  const game = useGame(services)
  const [input, setInput] = useState('')
  // Tile lights are stored against the pool arrangement they were made on.
  // A shuffle rearranges the tiles, so a stale selection is re-derived by
  // first-unused-match instead of pointing at the wrong letters.
  const [sel, setSel] = useState<{ pool: string; indexes: number[] }>({
    pool: '',
    indexes: [],
  })
  const [reducedMotion, setReducedMotion] = useState(
    services.reducedMotionDefault,
  )
  const [copied, setCopied] = useState(false)

  const selection = useMemo(() => {
    if (!game.pool) return []
    if (sel.pool === game.pool) return sel.indexes
    return reconcileSelection(game.pool, '', input, [])
  }, [game.pool, sel, input])

  const dayLabel = useMemo(
    () =>
      game.mode === 'daily'
        ? `Day ${game.dayNumber ?? ''}`
        : `Endless ${game.endlessSeed + 1}`,
    [game.mode, game.dayNumber, game.endlessSeed],
  )

  const setEntry = (nextInput: string, nextIndexes: number[]) => {
    setInput(nextInput)
    setSel({ pool: game.pool ?? '', indexes: nextIndexes })
  }

  const submit = () => {
    const outcome = game.submit(input)
    if (outcome !== 'rejected') setEntry('', [])
  }

  const share = () => {
    if (!game.puzzle || !game.run || !game.result || !game.entry) return
    const eights = game.puzzle.holds.fullRackWords
    const found = game.run.played.filter((p) =>
      eights.includes(p.word),
    ).length
    const text = buildShare({
      title: `Out of Sorts · ${dayLabel}`,
      words: game.run.played,
      rackSize: game.entry.rack.length,
      spentCount: game.run.spent.length,
      cleanDescent: game.result.isCleanDescent,
      allEights: eights.length >= 2 ? { found, total: eights.length } : null,
      rank: rankFor(game.result.score, game.puzzle.par),
      score: game.result.score,
      par: game.puzzle.par,
    })
    void navigator.clipboard?.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="app" data-reduced-motion={reducedMotion || undefined}>
      <header className="masthead">
        <div className="brand">
          <h1>Out of Sorts</h1>
          <p className="tagline">Every letter you don't use is gone.</p>
        </div>
        <nav className="modes" aria-label="Game mode">
          <button
            type="button"
            aria-pressed={game.mode === 'daily'}
            onClick={() => game.setMode('daily')}
          >
            Daily
          </button>
          <button
            type="button"
            aria-pressed={game.mode === 'endless'}
            onClick={() => game.setMode('endless')}
          >
            Endless
          </button>
        </nav>
        <div className="meta">
          {game.mode === 'daily' && game.streak > 1 && (
            <span className="streak" title="Daily streak">
              {game.streak} days
            </span>
          )}
          <button
            type="button"
            aria-pressed={reducedMotion}
            onClick={() => setReducedMotion(!reducedMotion)}
          >
            {reducedMotion ? 'Motion off' : 'Motion on'}
          </button>
        </div>
      </header>

      <main data-ready={game.ready || undefined}>
        {game.mode === 'daily' && game.calendarReady && !game.entry ? (
          <section className="no-daily" data-testid="no-daily">
            <h2>No puzzle today.</h2>
            <p>
              The daily calendar has not started yet. Endless is waiting
              whenever you are.
            </p>
            <button type="button" onClick={() => game.setMode('endless')}>
              Play Endless
            </button>
          </section>
        ) : game.result && game.puzzle && game.run ? (
          <EndScreen
            puzzle={game.puzzle}
            result={game.result}
            played={game.run.played}
            dayLabel={dayLabel}
            onShare={share}
            onNewEndless={game.mode === 'endless' ? game.newEndless : null}
          />
        ) : (
          <>
            <p className="day-label">{dayLabel}</p>
            <Drift
              spent={game.run?.spent ?? []}
              currentPlayCount={game.run?.played.length ?? 0}
              reducedMotion={reducedMotion}
            />
            {game.pool && (
              <Pool
                letters={game.pool}
                input={input}
                selection={selection}
                onTileClick={(letter, index) =>
                  setEntry(input + letter, [...selection, index])
                }
              />
            )}
            <form
              className="entry"
              onSubmit={(e) => {
                e.preventDefault()
                submit()
              }}
            >
              <label className="visually-hidden" htmlFor="word-input">
                Type a word
              </label>
              <input
                id="word-input"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={input}
                onChange={(e) => {
                  const next = e.target.value
                  setEntry(
                    next,
                    game.pool
                      ? reconcileSelection(game.pool, input, next, selection)
                      : [],
                  )
                }}
              />
              <div className="control-row" data-testid="control-row">
                <button
                  type="button"
                  onClick={() => game.shuffle()}
                >
                  Shuffle
                </button>
                <button type="button" onClick={() => setEntry('', [])}>
                  Clear
                </button>
                <button
                  type="button"
                  aria-label="Delete last letter"
                  onClick={() =>
                    setEntry(
                      input.slice(0, -1),
                      game.pool
                        ? reconcileSelection(
                            game.pool,
                            input,
                            input.slice(0, -1),
                            selection,
                          )
                        : [],
                    )
                  }
                >
                  ⌫
                </button>
                <button type="submit" className="spend">
                  Spend
                </button>
              </div>
            </form>
            {game.error && (
              <p className="entry-error" role="alert">
                {game.error}
              </p>
            )}
            {game.run && game.entry && (
              <Stack
                words={game.run.played}
                rackSize={game.entry.rack.length}
              />
            )}
            <div className="rest-row">
              <button
                type="button"
                className="stop-button"
                onClick={game.stop}
              >
                Stop
              </button>
            </div>
          </>
        )}
        {copied && <p role="status">Copied.</p>}
      </main>

      <div aria-live="polite" className="visually-hidden">
        {game.announcement}
      </div>
    </div>
  )
}
