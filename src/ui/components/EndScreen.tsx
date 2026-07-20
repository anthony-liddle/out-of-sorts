// The end of the run. Two different facts, and the engine distinguishes
// them: the pool genuinely dying earns the line the whole name was built
// for, and stopping early earns a rest. Badges, rank, and what was
// possible: the par path rendered as a ghosted stack beside the player's
// own, so the comparison is a silhouette, not a reading exercise. The eight
// count is revealed here and only here.
//
// And the ceremony. All Eights fires on 9.8 percent of racks and finding
// every eight is the rarest, hardest thing this game can produce, so the
// screen says so in words before it says the score. QUIET WARMTH, NEVER
// FIREWORKS: no confetti, no bounce, no exclamation mark. Ghosts are what is
// left of things, and a celebration that reads as perky has failed.
import type { CSSProperties } from 'react';
import type { Puzzle } from '../../engine/engine';
import type { PlayedWord, RunResult, SpentLetter } from '../../engine/run';
import { wordScore } from '../../engine/values';
import { rankFor } from '../../game/rank';
import { Stack } from './Stack';

function toRows(words: readonly string[]): PlayedWord[] {
  return words.map((w) => ({ word: w, score: wordScore(w), length: w.length }));
}

export interface EndScreenProps {
  puzzle: Puzzle;
  result: RunResult;
  played: readonly PlayedWord[];
  /** The run's dead, for the ceremony to gather. At most five: every letter
   * spent is gone forever and a run ends at a pool of three. */
  spent?: readonly SpentLetter[];
  /** The run's identifier, or null when there is none to show. Daily has
   * none: DAY N existed to be a shared reference and the share now names
   * the date, so on your own end screen it only restated what you know.
   * Endless keeps `Endless N`. */
  label: string | null;
  onShare: () => void;
  /** True once the share text is on the clipboard. Never true for the native
   * sheet, which says so itself. */
  copied?: boolean;
  onNewEndless: (() => void) | null;
  reducedMotion?: boolean;
}

/**
 * The eights, revealed. Not a caption: this is the payoff of the rarest
 * badge in the game, and it shipped as grey 14px text below the fold of
 * attention. Mint, because mint is the eights and nothing else.
 */
function EightsReveal({ eights }: { eights: readonly string[] }) {
  return (
    <div className="eights-reveal" data-testid="eights-reveal">
      <p className="eights-label">{eights.length === 1 ? 'The eight' : 'The eights'}</p>
      <p className="eights-words">
        {eights.map((word) => (
          <span className="eight-word" data-testid="eight-word" key={word}>
            {word.toUpperCase()}
          </span>
        ))}
      </p>
    </div>
  );
}

/**
 * The ghosts gather. The run's spent letters drift in over the reveal and
 * settle, once, and hold: loss becomes an audience. They reuse the drift's
 * own glyph and its bob, so this is the same ghost, not a second species.
 * Reduced motion suppresses the gathering and leaves them simply present.
 */
function Gathering({
  spent,
  reducedMotion,
}: {
  spent: readonly SpentLetter[];
  reducedMotion: boolean;
}) {
  if (spent.length === 0) return null;
  return (
    <div
      className="gathering"
      data-testid="gathering"
      data-motion={reducedMotion ? 'off' : 'on'}
      role="img"
      aria-label={`The letters you spent: ${spent
        .map((s) => s.letter.toUpperCase())
        .join(', ')}`}
    >
      {spent.map((s, i) => (
        <span
          className="gather-ghost"
          data-testid="gather-ghost"
          key={`${s.letter}-${i}`}
          // Staggered, so they arrive as individuals rather than a chorus
          // line. One beat, and then they hold.
          style={{ '--gather-delay': `${i * 110}ms` } as CSSProperties}
        >
          <span className="ghost-bob">
            <span className="ghost-body" aria-hidden="true" />
            <span className="ghost-letter">{s.letter.toUpperCase()}</span>
          </span>
        </span>
      ))}
    </div>
  );
}

export function EndScreen({
  puzzle,
  result,
  played,
  spent = [],
  label,
  onShare,
  copied = false,
  onNewEndless,
  reducedMotion = false,
}: EndScreenProps) {
  const playedWords = played.map((p) => p.word);
  const rank = rankFor(result.score, puzzle.par);
  // The solver's common-pool hold inventory. NEVER the calendar's baked
  // boundary list: AEGINRST holds 5 common eights and 12 boundary ones.
  const eights = puzzle.holds.fullRackWords;
  const foundEights = playedWords.filter((w) => eights.includes(w)).length;
  const multiEight = eights.length >= 2;
  const allEights = multiEight && foundEights === eights.length;
  const diverges = puzzle.bestClean !== null && puzzle.par !== puzzle.bestClean;
  const gap = puzzle.bestClean === null ? 0 : puzzle.par - puzzle.bestClean;

  return (
    <section className="end-screen" data-testid="end-screen">
      {/* On a single-eight rack none of this exists, and that is the rule:
          ABSENCE, NEVER FAILURE. 90.2 percent of racks hold exactly one, and
          a ceremony for playing the obvious opener is not a ceremony. */}
      {allEights && (
        <section className="ceremony" data-testid="ceremony">
          <Gathering spent={spent} reducedMotion={reducedMotion} />
          <p className="ceremony-line" data-testid="ceremony-line">
            You left nothing in the case.
          </p>
          <EightsReveal eights={eights} />
        </section>
      )}

      <h2>
        {result.endReason === 'clean-finish'
          ? 'Out of sorts.'
          : 'Rested early.'}
      </h2>
      <p className="end-sub" data-testid="end-sub">
        {label && `${label} · `}
        {result.score} points · par {puzzle.par}
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
        <h3>How it could have gone</h3>
        {diverges ? (
          <p className="day-shape">
            <strong>Clean Descent wasn't on the best path today.</strong>{' '}
            Staying clean would have cost you {gap} of {puzzle.par} points.
          </p>
        ) : (
          <p className="day-shape">
            <strong>The best path was also a clean one.</strong>
          </p>
        )}
        <div className="stack-compare" data-columns={diverges ? 3 : 2}>
          <figure data-testid="your-stack-figure">
            <figcaption>Yours · {result.score}</figcaption>
            {played.length === 0 ? (
              <p className="stack-empty">You spent nothing.</p>
            ) : (
              <Stack
                words={played}
                rackSize={puzzle.rack.length}
                testId="your-stack"
              />
            )}
          </figure>
          <figure>
            <figcaption>Best · {puzzle.par}</figcaption>
            <Stack
              words={toRows(puzzle.parPath)}
              rackSize={puzzle.rack.length}
              ghosted
              testId="par-stack"
            />
          </figure>
          {diverges && puzzle.cleanPath && (
            <figure className="clean-figure">
              <figcaption>Clean · {puzzle.bestClean}</figcaption>
              <Stack
                words={toRows(puzzle.cleanPath)}
                rackSize={puzzle.rack.length}
                ghosted
                testId="clean-stack"
              />
            </figure>
          )}
        </div>
        {/* A multi-eight rack where one got away still reveals them, because
            the player wants to know what was there. It just does not get the
            ceremony: the reveal is information, the ceremony is the peak. */}
        {multiEight && !allEights && <EightsReveal eights={eights} />}
      </section>

      <div className="end-actions">
        <button
          type="button"
          className="share-button"
          data-testid="share-button"
          data-copied={copied || undefined}
          onClick={onShare}
        >
          {/* Both labels are always in the DOM, stacked in one grid cell, so
              the button is already as wide and as tall as its widest state.
              "Copied." used to be a new paragraph below the buttons and it
              pushed the footer down on every single copy. */}
          <span className="share-idle" data-testid="share-idle">
            Share
          </span>
          <span className="share-done" data-testid="share-done" aria-hidden={!copied}>
            Copied.
          </span>
        </button>
        {onNewEndless && (
          <button type="button" onClick={onNewEndless}>
            New rack
          </button>
        )}
      </div>
    </section>
  );
}
