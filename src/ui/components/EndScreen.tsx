// The end of the run. Two different facts, and the engine distinguishes
// them: a Clean Finish (the pool is genuinely dead) or the player stopped.
// Shows the badges, the score against par, the rank, and what was possible.
// The eight count is revealed here and only here.
import type { Puzzle } from '../../engine/engine'
import type { RunResult } from '../../engine/run'
import { rankFor } from '../../game/rank'

export interface EndScreenProps {
  puzzle: Puzzle
  result: RunResult
  playedWords: readonly string[]
  dayLabel: string
  onShare: () => void
  onNewEndless: (() => void) | null
}

export function EndScreen({
  puzzle,
  result,
  playedWords,
  dayLabel,
  onShare,
  onNewEndless,
}: EndScreenProps) {
  const rank = rankFor(result.score, puzzle.par)
  const eights = puzzle.holds.fullRackWords
  const foundEights = playedWords.filter((w) => eights.includes(w)).length
  const multiEight = eights.length >= 2
  const allEights = multiEight && foundEights === eights.length

  return (
    <section className="end-screen" data-testid="end-screen">
      <h2>
        {result.endReason === 'clean-finish'
          ? 'Out of sorts.'
          : 'Rested early.'}
      </h2>
      <p className="end-sub">
        {dayLabel} · {result.score} points · par {puzzle.par}
      </p>

      <ul className="badges">
        <li
          className="badge"
          data-testid="badge-clean"
          data-earned={result.isCleanDescent || undefined}
        >
          <span className="badge-name">Clean Descent</span>
          <span className="badge-state">
            {result.isCleanDescent ? 'earned' : 'not this time'}
          </span>
        </li>
        {multiEight && (
          <li
            className="badge badge-rose"
            data-testid="badge-all-eights"
            data-earned={allEights || undefined}
          >
            <span className="badge-name">All Eights</span>
            <span className="badge-state" data-testid="eight-count">
              {foundEights}/{eights.length}
            </span>
          </li>
        )}
        <li className="badge" data-testid="badge-rank">
          <span className="badge-name">{rank.name}</span>
          <span className="badge-state">
            {Math.round(rank.fraction * 100)}% of par
          </span>
        </li>
      </ul>

      <details className="possible">
        <summary>What was possible</summary>
        <p>
          Par path:{' '}
          {puzzle.parPath.map((w) => w.toUpperCase()).join(' > ')}
        </p>
        {puzzle.cleanPath && (
          <p>
            Clean path:{' '}
            {puzzle.cleanPath.map((w) => w.toUpperCase()).join(' > ')}
          </p>
        )}
        {multiEight && (
          <p>
            The eights:{' '}
            {eights
              .map((w) =>
                playedWords.includes(w) ? w.toUpperCase() : w.toUpperCase(),
              )
              .join(', ')}
          </p>
        )}
      </details>

      <div className="end-actions">
        <button type="button" onClick={onShare}>
          Copy share text
        </button>
        {onNewEndless && (
          <button type="button" onClick={onNewEndless}>
            New rack
          </button>
        )}
      </div>
    </section>
  )
}
