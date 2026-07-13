// The end of the run. Two different facts, and the engine distinguishes
// them: the pool genuinely dying earns the line the whole name was built
// for, and stopping early earns a rest. Badges, rank, and what was
// possible: the par path rendered as a ghosted stack beside the player's
// own, so the comparison is a silhouette, not a reading exercise. The eight
// count is revealed here and only here.
import type { Puzzle } from '../../engine/engine'
import type { PlayedWord, RunResult } from '../../engine/run'
import { wordScore } from '../../engine/values'
import { rankFor } from '../../game/rank'
import { Stack } from './Stack'

function toRows(words: readonly string[]): PlayedWord[] {
  return words.map((w) => ({ word: w, score: wordScore(w), length: w.length }))
}

export interface EndScreenProps {
  puzzle: Puzzle
  result: RunResult
  played: readonly PlayedWord[]
  dayLabel: string
  onShare: () => void
  onNewEndless: (() => void) | null
}

export function EndScreen({
  puzzle,
  result,
  played,
  dayLabel,
  onShare,
  onNewEndless,
}: EndScreenProps) {
  const playedWords = played.map((p) => p.word)
  const rank = rankFor(result.score, puzzle.par)
  const eights = puzzle.holds.fullRackWords
  const foundEights = playedWords.filter((w) => eights.includes(w)).length
  const multiEight = eights.length >= 2
  const allEights = multiEight && foundEights === eights.length
  const diverges =
    puzzle.bestClean !== null && puzzle.par !== puzzle.bestClean;
  const gap = puzzle.bestClean === null ? 0 : puzzle.par - puzzle.bestClean;
  // Where the best path first breaks clean: the move whose word is more
  // than one letter shorter than the pool it was played from.
  let firstBreak = { move: 0, dropped: 0 };
  let poolSize = puzzle.rack.length;
  for (let i = 0; i < puzzle.parPath.length; i++) {
    const len = puzzle.parPath[i]!.length;
    if (len < poolSize - 1) {
      firstBreak = { move: i + 1, dropped: poolSize - len };
      break;
    }
    poolSize = len;
  }
  const droppedWord =
    ['zero', 'one', 'two', 'three', 'four', 'five'][firstBreak.dropped] ??
    String(firstBreak.dropped);

  return (
    <section className="end-screen" data-testid="end-screen">
      <h2>
        {result.endReason === 'clean-finish' ? 'Out of sorts.' : 'Rested early.'}
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

      <section className="possible">
        <h3>What was possible</h3>
        {diverges ? (
          <p className="day-shape">
            <strong>Today, greed and discipline pulled apart.</strong> The
            best path drops {droppedWord} letters{' '}
            {firstBreak.move === 1 ? 'right away' : `on move ${firstBreak.move}`}
            . Staying clean costs you {gap} points.
          </p>
        ) : (
          <p className="day-shape">
            <strong>The best path was also a clean one.</strong> No choice to
            make today.
          </p>
        )}
        <div className="stack-compare" data-columns={diverges ? 3 : 2}>
          <figure>
            <figcaption>
              <span className="column-name">Yours</span>
              <small>{result.score} points</small>
            </figcaption>
            <Stack
              words={played}
              rackSize={puzzle.rack.length}
              testId="your-stack"
            />
          </figure>
          <figure>
            <figcaption>
              <span className="column-name">Best</span>
              <small>
                {puzzle.par} points · the most points possible
                {diverges ? '' : ' · also clean'}
              </small>
            </figcaption>
            <Stack
              words={toRows(puzzle.parPath)}
              rackSize={puzzle.rack.length}
              ghosted
              testId="par-stack"
            />
          </figure>
          {diverges && puzzle.cleanPath && (
            <figure>
              <figcaption>
                <span className="column-name">Clean</span>
                <small>
                  {puzzle.bestClean} points · the most points possible
                  without ever losing more than one letter at a time
                </small>
              </figcaption>
              <Stack
                words={toRows(puzzle.cleanPath)}
                rackSize={puzzle.rack.length}
                ghosted
                testId="clean-stack"
              />
            </figure>
          )}
        </div>
        {multiEight && (
          <p className="eights-reveal">
            The eights: {eights.map((w) => w.toUpperCase()).join(', ')}
          </p>
        )}
      </section>

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
