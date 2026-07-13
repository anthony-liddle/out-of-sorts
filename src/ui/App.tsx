import { useMemo, useState } from 'react'
import { rankFor } from '../game/rank'
import { buildShare } from '../game/share'
import { EndScreen } from './components/EndScreen'
import { Pool } from './components/Pool'
import { SpentRow } from './components/SpentRow'
import { Stack } from './components/Stack'
import type { GameServices } from './services'
import { useGame } from './useGame'
import './theme.css'

export function App({ services }: { services: GameServices }) {
  const game = useGame(services)
  const [input, setInput] = useState('')
  const [reducedMotion, setReducedMotion] = useState(
    services.reducedMotionDefault,
  )
  const [muted, setMuted] = useState(services.audio.muted)
  const [copied, setCopied] = useState(false)

  const dayLabel = useMemo(
    () =>
      game.mode === 'daily'
        ? `Day ${game.dayNumber ?? ''}`
        : `Endless ${game.endlessSeed + 1}`,
    [game.mode, game.dayNumber, game.endlessSeed],
  )

  const submit = () => {
    const outcome = game.submit(input)
    if (outcome !== 'rejected') setInput('')
  }

  const share = () => {
    if (!game.puzzle || !game.run || !game.result || !game.entry) return
    const eights = game.puzzle.holds.fullRackWords
    const found = game.run.played.filter((p) =>
      eights.includes(p.word),
    ).length
    const text = buildShare({
      title: `Out of Sorts, ${dayLabel}`,
      words: game.run.played,
      rackSize: game.entry.rack.length,
      cleanDescent: game.result.isCleanDescent,
      allEights:
        eights.length >= 2 ? { found, total: eights.length } : null,
      rank: rankFor(game.result.score, game.puzzle.par),
    })
    void navigator.clipboard?.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="app" data-reduced-motion={reducedMotion || undefined}>
      <header className="masthead">
        <h1>Out of Sorts</h1>
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
            aria-pressed={muted}
            onClick={() => {
              services.audio.setMuted(!muted)
              setMuted(!muted)
            }}
          >
            {muted ? 'Sound off' : 'Sound on'}
          </button>
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
        {game.result && game.puzzle && game.run ? (
          <EndScreen
            puzzle={game.puzzle}
            result={game.result}
            playedWords={game.run.played.map((p) => p.word)}
            dayLabel={dayLabel}
            onShare={share}
            onNewEndless={game.mode === 'endless' ? game.newEndless : null}
          />
        ) : (
          <>
            <p className="day-label">{dayLabel}</p>
            {game.pool && (
              <Pool
                letters={game.pool}
                input={input}
                onTileClick={(letter) => setInput((v) => v + letter)}
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
                onChange={(e) => setInput(e.target.value)}
              />
              <button type="submit">Play</button>
              <button type="button" onClick={game.stop}>
                Stop
              </button>
            </form>
            {game.error && (
              <p className="entry-error" role="alert">
                {game.error}
              </p>
            )}
            <div className="board-lower">
              {game.run && game.entry && (
                <Stack
                  words={game.run.played}
                  rackSize={game.entry.rack.length}
                />
              )}
              {game.run && game.run.spent.length > 0 && (
                <SpentRow
                  spent={game.run.spent}
                  currentPlayCount={game.run.played.length}
                  reducedMotion={reducedMotion}
                />
              )}
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
