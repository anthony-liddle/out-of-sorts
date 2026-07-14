import { useEffect, useMemo, useState } from 'react';
import { rankFor } from '../game/rank';
import { buildShare } from '../game/share';
import { GHOST_WIDTH } from './haunt-layout';
import { Haunt, type HauntBirths } from './components/Haunt';
import { EndScreen } from './components/EndScreen';
import { Footer } from './components/Footer';
import { HowItWorks } from './components/HowItWorks';
import { Pool, reconcileSelection } from './components/Pool';
import { WordDisplay } from './components/WordDisplay';
import { Stack } from './components/Stack';
import type { GameServices } from './services';
import { deliverShare } from './share-out';
import { useGame } from './useGame';
import { useKeyboard } from './useKeyboard';
import './theme.css';

export function App({ services }: { services: GameServices }) {
  const game = useGame(services);
  const [input, setInput] = useState('');
  // Tile lights are stored against the pool arrangement they were made on.
  // A shuffle rearranges the tiles, so a stale selection is re-derived by
  // first-unused-match instead of pointing at the wrong letters.
  const [sel, setSel] = useState<{ pool: string; indexes: number[] }>({
    pool: '',
    indexes: [],
  });
  // Reduced motion follows the operating system, with no in game toggle:
  // the OS setting is the one the player already made.
  const reducedMotion = services.reducedMotionDefault;
  const [copied, setCopied] = useState(false);
  // The tiles a Spend is about to drop, captured at the moment the button
  // is pressed, so each new ghost can rise from the tile that spent it.
  // Session only, and overwritten on every submit: a reload has no births
  // and the settled dead do not re-rise.
  const [births, setBirths] = useState<HauntBirths | null>(null);
  // The only route in the game: #how shows the rules instead of the
  // board. A hash, not a router, so the back button and a plain anchor
  // both just work.
  const [route, setRoute] = useState(() => window.location.hash);
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const showingHow = route === '#how';

  const selection = useMemo(() => {
    if (!game.pool) return [];
    if (sel.pool === game.pool) return sel.indexes;
    return reconcileSelection(game.pool, '', input, []);
  }, [game.pool, sel, input]);

  const dayLabel = useMemo(
    () =>
      game.mode === 'daily'
        ? `Day ${game.dayNumber ?? ''}`
        : `Endless ${game.endlessSeed + 1}`,
    [game.mode, game.dayNumber, game.endlessSeed],
  );

  const setEntry = (nextInput: string, nextIndexes: number[]) => {
    // Any touch of a letter makes the last rejection stale.
    if (game.error) game.clearError();
    setInput(nextInput);
    setSel({ pool: game.pool ?? '', indexes: nextIndexes });
  };

  /**
   * Spend always leaves a clean board, valid or not. A rejected word used to
   * keep its letters lit as used, so the tiles were showing a committed
   * state for a word that never committed: the pixels claiming something
   * the state does not support. The error still names the word, so nothing
   * informational is lost, and it clears on the next input.
   *
   * The accepted cost: an eight letter word rejected for a typo now costs
   * eight taps to retype. A board that lies about itself is worse.
   */
  const submit = () => {
    const layer = document.querySelector('[data-testid="haunt"]');
    if (layer && game.run) {
      const layerBox = layer.getBoundingClientRect();
      const used = new Set(selection.filter((i) => i >= 0));
      const at = [...document.querySelectorAll('[data-testid="pool-tile"]')]
        .filter((_, i) => !used.has(i))
        .map((tile) => {
          const box = tile.getBoundingClientRect();
          return {
            letter: tile.textContent?.trim().toLowerCase() ?? '',
            x: box.left + box.width / 2 - GHOST_WIDTH / 2 - layerBox.left,
            y: box.top - layerBox.top,
          };
        });
      setBirths({ playIndex: game.run.played.length, at });
    }
    game.submit(input);
    // Reset the entry WITHOUT the stale error clearing that setEntry does:
    // this submit may have just set a fresh message, and it must not clear
    // its own.
    setInput('');
    setSel({ pool: game.pool ?? '', indexes: [] });
  };

  const backspace = () =>
    setEntry(
      input.slice(0, -1),
      game.pool
        ? reconcileSelection(game.pool, input, input.slice(0, -1), selection)
        : [],
    );

  const clear = () => setEntry('', []);

  /** A typed letter takes the first unused tile bearing it, which is the
   * same rule a tapped tile follows by index. A letter the pool cannot
   * supply is simply ignored: the tiles are the alphabet here. */
  const typeLetter = (letter: string) => {
    if (!game.pool) return;
    const next = input + letter;
    const nextSelection = reconcileSelection(game.pool, input, next, selection);
    if (nextSelection[nextSelection.length - 1] === -1) return;
    setEntry(next, nextSelection);
  };

  // You open the game and type. No click to focus, ever.
  useKeyboard(
    useMemo(
      () => ({
        letter: typeLetter,
        spend: submit,
        backspace,
        clear,
      }),
      // these close over the current input and selection, so they must be
      // rebuilt when either changes
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [input, selection, game.pool, game.submit],
    ),
    !game.result && !showingHow,
  );

  const share = () => {
    if (!game.puzzle || !game.run || !game.result || !game.entry) return;
    const eights = game.puzzle.holds.fullRackWords;
    const found = game.run.played.filter((p) => eights.includes(p.word)).length;
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
    });
    // The native sheet where the browser has one, the clipboard where it does
    // not, feature detected. "Copied." is only ever said when something was
    // in fact copied: the sheet announces itself, and a sheet the player
    // dismissed did nothing at all.
    void deliverShare(text).then((outcome) => {
      if (outcome !== 'copied') return;
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="app" data-reduced-motion={reducedMotion || undefined}>
      <header className="masthead">
        {/* A title page, not a toolbar: eyebrow, title, rule flanked
            subtitle, then a hairline before the game begins. Centered,
            like everything the game owns. The copy is Antoine's pick. */}
        <div className="brand">
          <p className="marque" data-testid="marque">
            A game of what you can bear to lose
          </p>
          <h1>Out of Sorts</h1>
          <p className="subtitle" data-testid="subtitle">
            Spend the type
          </p>
        </div>
        <hr className="masthead-rule" data-testid="masthead-divider" />
        <div className="masthead-row">
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
              /* "3 days" is a number with no noun. Label it: the streak is
                 the only thing in the header that persists between runs, and
                 a bare count says nothing about what it counts. */
              <span className="streak" data-testid="streak">
                Streak {game.streak}
              </span>
            )}
            {game.run && !game.result && (
              /* The running total: quiet, always visible, and it climbs.
                 Score only. Rank and par stay the end screen's reveal,
                 because rank is a fraction of par. The key remounts the
                 number so each climb gets its small rise, which reduced
                 motion suppresses wholesale. */
              <span
                className="running-score"
                data-testid="running-score"
                key={game.run.score}
              >
                {game.run.score} points
              </span>
            )}
          </div>
        </div>
      </header>

      <main data-ready={game.ready || undefined}>
        {showingHow ? (
          <HowItWorks />
        ) : game.mode === 'daily' && game.calendarReady && !game.entry ? (
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
            spent={game.run.spent}
            dayLabel={dayLabel}
            onShare={share}
            copied={copied}
            onNewEndless={game.mode === 'endless' ? game.newEndless : null}
            reducedMotion={reducedMotion}
          />
        ) : (
          /* The page, not a strip: on wide viewports the board keeps its
             column and the stack moves beside it, where the run's shape
             reads at full height. Below the breakpoint the wrappers are
             display: contents, so the phone layout is the same layout. */
          <div className="play-grid">
            <div className="board-col">
              <p className="day-label">{dayLabel}</p>
              <div className="drift" data-testid="drift">
                {(game.run?.spent.length ?? 0) === 0 && (
                  <p className="drift-empty">Nothing lost yet.</p>
                )}
              </div>
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
              <div className="entry">
                <WordDisplay word={input} error={game.error} />
                <div className="control-row" data-testid="control-row">
                  <button type="button" onClick={() => game.shuffle()}>
                    Shuffle
                  </button>
                  <button type="button" onClick={clear}>
                    Clear
                  </button>
                  <button
                    type="button"
                    aria-label="Delete last letter"
                    onClick={backspace}
                  >
                    ⌫
                  </button>
                  <button type="button" className="spend" onClick={submit}>
                    Spend
                  </button>
                </div>
              </div>
              {/* Stop is a run control, so it lives with the board: under
                  the controls, quiet, with air between it and Spend (never
                  one fat finger away), and never alone in an empty region. */}
              <div className="rest-row">
                <button
                  type="button"
                  className="stop-button"
                  onClick={game.stop}
                >
                  Stop
                </button>
              </div>
            </div>
            <Haunt
              spent={game.run?.spent ?? []}
              currentPlayCount={game.run?.played.length ?? 0}
              reducedMotion={reducedMotion}
              births={births}
            />
            <aside className="stack-col">
              {/* Reserved, not collapsed: the board never moves when the
                  first word lands. Until then the column speaks, in voice,
                  mirroring the drift's "Nothing lost yet." The line only
                  shows where the column exists; on a phone the drift
                  already carries the fresh rack. */}
              {game.run &&
                game.entry &&
                (game.run.played.length > 0 ? (
                  <Stack
                    words={game.run.played}
                    rackSize={game.entry.rack.length}
                  />
                ) : (
                  <p className="stack-waiting" data-testid="stack-waiting">
                    Nothing spent yet.
                  </p>
                ))}
            </aside>
          </div>
        )}
        {/* "Copied." is said by the button, in place, in a slot that already
            reserves the room for it. It used to be a paragraph that appeared
            here and pushed the whole footer down on every copy. The spoken
            confirmation stays, out of the layout entirely. */}
        <p role="status" className="visually-hidden">
          {copied ? 'Copied.' : ''}
        </p>
      </main>

      <Footer />

      <div aria-live="polite" className="visually-hidden">
        {game.announcement}
      </div>
    </div>
  );
}
