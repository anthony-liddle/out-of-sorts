// The game orchestration hook. The engine is the single source of truth:
// this hook never computes a score, a legality, a hold, or a par. It keeps
// only the played words per mode; every piece of engine state (run, score,
// spent letters, end detection, result) is DERIVED by replaying those words
// through the engine. Daily and Endless each keep a slot; switching modes
// is a view change and never resets either.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { rackForDate } from '../calendar/day';
import { endlessEntry } from '../calendar/endless';
import {
  dailyRunKey,
  ENDLESS_RUN_KEY,
  localDaysBetween,
  storageDayIndex,
} from '../calendar/epochs';
import type { Calendar, CalendarEntry } from '../calendar/types';
import {
  createEngine,
  scrambleRack,
  type Engine,
  type Puzzle,
} from '../engine/engine';
import { hashString } from '../engine/prng';
import {
  applyPlay,
  createRun,
  finishRun,
  isLegalPlay,
  type RunResult,
  type RunState,
} from '../engine/run';
import {
  loadJson,
  loadRunSnapshot,
  saveJson,
  saveRunSnapshot,
} from '../game/persistence';
import { advanceStreak, currentStreak, type Streak } from '../game/streak';
import type { GameServices } from './services';

export type Mode = 'daily' | 'endless';
export type SubmitOutcome = 'played' | 'queued' | 'rejected';

interface ModeProgress {
  words: string[];
  stopped: boolean;
  /** Rack the words belong to, from the restored snapshot. Words are only
   * replayed when it matches the entry, so a re-anchored calendar can never
   * replay one rack's words into another. */
  rack: string | null;
  seed: number;
}

type Progress = Record<Mode, ModeProgress>;

function restoreProgress(services: GameServices): Progress {
  const daily = loadRunSnapshot(services.storage, dailyRunKey(services.now()));
  const endless = loadRunSnapshot(services.storage, ENDLESS_RUN_KEY);
  return {
    daily: {
      words: daily?.words ?? [],
      stopped: daily?.stopped ?? false,
      rack: daily?.rack ?? null,
      seed: 0,
    },
    endless: {
      words: endless?.words ?? [],
      stopped: endless?.stopped ?? false,
      rack: endless?.rack ?? null,
      seed: endless?.endlessSeed ?? 0,
    },
  };
}

/**
 * The rack for a mode, or null when the daily has none. NEVER clamp a
 * pre-epoch date to entry 0: that substitutes a plausible wrong rack for a
 * null the calendar returned deliberately, and it is what hid a future
 * calendar epoch for the entire life of the project (every daily served
 * entry 0, and nothing complained).
 */
function entryFor(
  calendar: Calendar,
  mode: Mode,
  now: Date,
  seed: number,
): { entry: CalendarEntry; dayNumber: number | null; date: Date } | null {
  if (mode === 'daily') {
    const entry = rackForDate(calendar, now);
    if (!entry) {
      if (import.meta.env.DEV) {
        throw new Error(
          `No daily for ${now.toDateString()}: the calendar epoch ` +
            `(${calendar.epoch}) is in the future. Move it; it is the ` +
            `movable epoch and moving it costs no streaks.`,
        );
      }
      return null;
    }
    const dayIndex = localDaysBetween(calendar.epoch, now);
    // The date that SELECTED this rack, carried with it. The share names it
    // rather than re-reading the clock: a run played at 23:58 and finished
    // at 00:01 would otherwise be shared under a date whose rack the player
    // never saw. One fact, one source.
    return { entry, dayNumber: dayIndex + 1, date: now };
  }
  return { entry: endlessEntry(calendar, seed), dayNumber: null, date: now };
}

/** Replay words through the engine. Illegal words (a changed dictionary,
 * a corrupt snapshot) are skipped rather than crashing the run. */
function replay(puzzle: Puzzle, words: readonly string[]): RunState {
  let run = createRun(puzzle);
  for (const word of words) {
    if (isLegalPlay(puzzle, run, word)) run = applyPlay(puzzle, run, word);
  }
  return run;
}

export function useGame(services: GameServices) {
  const [mode, setMode] = useState<Mode>('daily');
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [progress, setProgress] = useState<Progress>(() =>
    restoreProgress(services),
  );
  const [announcement, setAnnouncement] = useState('');
  const [shuffleSalt, setShuffleSalt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const queueRef = useRef<{ mode: Mode; word: string }[]>([]);
  const endedKeysRef = useRef<Set<string>>(new Set());
  /**
   * The stored streak RECORD, held in state and read from storage exactly
   * once. It used to be read in the render path, so when the end-of-run
   * effect wrote a new value nothing re-rendered and the end screen could go
   * on showing the pre-run streak until some unrelated interaction forced a
   * paint. Storage is not a reactive source; state is.
   */
  const [streakRecord, setStreakRecord] = useState<Streak | undefined>(
    () => loadJson<Streak>(services.storage, 'streak') ?? undefined,
  );

  // External systems arrive through promise callbacks, never effect bodies.
  useEffect(() => {
    let alive = true;
    void services.loadCalendar().then((c) => {
      if (alive) setCalendar(c);
    });
    void services.loadDictionaries().dictionaries.then(async (dicts) => {
      const cal = await services.loadCalendar();
      if (!alive) return;
      const eng = createEngine(dicts);
      setEngine(eng);
      const queued = queueRef.current;
      queueRef.current = [];
      if (queued.length > 0) {
        setProgress((prev) => flushQueue(prev, cal, eng, queued, services));
      }
    });
    return () => {
      alive = false;
    };
  }, [services]);

  const now = services.now();
  const active = useMemo(
    () =>
      calendar ? entryFor(calendar, mode, now, progress[mode].seed) : null,
    // now is derived from services and stable enough per render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [calendar, mode, progress],
  );

  const puzzle = useMemo(
    () => (engine && active ? engine.createPuzzle(active.entry.rack) : null),
    [engine, active],
  );

  const words = useMemo(() => {
    const p = progress[mode];
    if (!active) return [];
    return p.rack === null || p.rack === active.entry.rack ? p.words : [];
  }, [progress, mode, active]);

  const run = useMemo(
    () => (puzzle ? replay(puzzle, words) : null),
    [puzzle, words],
  );

  const stopped = progress[mode].stopped;
  const result: RunResult | null = useMemo(
    () =>
      puzzle && run && (run.ended || stopped) ? finishRun(puzzle, run) : null,
    [puzzle, run, stopped],
  );

  /**
   * True when this mode has a run saved that the game cannot yet tell the
   * truth about.
   *
   * The flash was never a localStorage race: progress is read synchronously
   * in the lazy initializer above and is present on render 1. It is the
   * ENGINE. `run` needs `puzzle` needs `engine` needs the dictionary, which
   * lands about a second later, off the critical path and deliberately so.
   * Until it does, a finished daily has no `result` (so the board painted as
   * playable and then flipped) and a mid-run pool falls back to the entry's
   * RACK (so the player was shown eight letters they no longer own, which is
   * worse).
   *
   * THE GATE IS RESTORED-WORDS-AND-NO-RUN, AND NOTHING WIDER. A fresh rack
   * has nothing to restore, so nothing about it is unknowable, so it still
   * renders in 0 to 2ms with no loading state at all. Never gate on the
   * dictionary in general: that would undo the entire cold start design.
   * Both modes carry their own saved run, so they gate independently.
   */
  const restoring =
    (progress[mode].words.length > 0 || stopped) && run === null;

  const pool = useMemo(() => {
    if (!active) return null;
    // THE POOL DISPLAY MUST NEVER SPELL A VALID WORD, AT ANY SIZE. Before
    // the dictionary lands only the opening eight can render, and the
    // calendar's baked list guards it. From then on the puzzle's formable
    // boundary set guards every redisplay and every shuffle: any word an
    // arrangement of this pool could spell is formable from the rack, so
    // membership in puzzle.valid is the exact hazard set.
    const forbidden = puzzle
      ? (d: string) => puzzle.valid.has(d)
      : (d: string) => active.entry.eights.includes(d);
    const salt = progress[mode].seed + shuffleSalt * 7919;
    if (!run || run.played.length === 0) {
      return scrambleRack(
        active.entry.rack,
        hashString(active.entry.rack) + salt,
        forbidden,
      );
    }
    const lastWord = run.played[run.played.length - 1]!.word;
    return scrambleRack(
      lastWord,
      hashString(active.entry.rack) + run.played.length + salt,
      forbidden,
    );
  }, [active, puzzle, run, progress, mode, shuffleSalt]);

  const shuffle = useCallback(() => setShuffleSalt((v) => v + 1), []);

  // Persist to local storage: syncing React state out to an external
  // system, which is exactly what effects are for.
  useEffect(() => {
    if (!calendar) return;
    for (const m of ['daily', 'endless'] as const) {
      const p = progress[m];
      const active = entryFor(calendar, m, services.now(), p.seed);
      if (!active) continue;
      const { entry } = active;
      saveRunSnapshot(
        services.storage,
        m === 'daily' ? dailyRunKey(services.now()) : ENDLESS_RUN_KEY,
        {
          rack: p.rack ?? entry.rack,
          words: p.words,
          stopped: p.stopped,
          ...(m === 'endless' ? { endlessSeed: p.seed } : {}),
        },
      );
    }
  }, [progress, calendar, services]);

  // The end of a daily advances the streak, once per run.
  useEffect(() => {
    if (!result || mode !== 'daily' || !active) return;
    const key = `daily-${active.entry.rack}`;
    if (endedKeysRef.current.has(key)) return;
    endedKeysRef.current.add(key);
    setStreakRecord((prev) => {
      const next = advanceStreak(prev, storageDayIndex(services.now()));
      saveJson(services.storage, 'streak', next);
      return next;
    });
  }, [result, mode, active, services]);

  const submit = useCallback(
    (rawWord: string): SubmitOutcome => {
      const word = rawWord.trim().toLowerCase();
      if (!word || !active) return 'rejected';
      if (!puzzle || !run) {
        queueRef.current.push({ mode, word });
        return 'queued';
      }
      if (result) return 'rejected';
      if (!isLegalPlay(puzzle, run, word)) {
        const reason = run.played.some((p) => p.word === word)
          ? `${word.toUpperCase()} is already on the stack.`
          : word.length < 3
            ? 'Words need at least three letters.'
            : `${word.toUpperCase()} is not a word this pool can make.`;
        setError(reason);
        setAnnouncement(reason);
        return 'rejected';
      }
      const before = run.pool.length;
      const next = applyPlay(puzzle, run, word);
      const played = next.played[next.played.length - 1]!;
      const dropped = next.spent.slice(run.spent.length).map((s) => s.letter);
      playSound(services, puzzle, next, word, before);
      setAnnouncement(
        `Played ${word.toUpperCase()} for ${played.score} points.` +
          (dropped.length > 0
            ? ` Dropped ${dropped.map((l) => l.toUpperCase()).join(', ')}.`
            : ' Held every letter.') +
          (next.ended ? ' The pool is out of sorts.' : ''),
      );
      if (next.ended) services.audio.play('end');
      setError(null);
      setProgress((prev) => ({
        ...prev,
        [mode]: {
          ...prev[mode],
          rack: active.entry.rack,
          words: [...prev[mode].words, word],
        },
      }));
      return 'played';
    },
    [active, puzzle, run, result, mode, services],
  );

  /** The rejection message is about the word you just tried. The moment you
   * touch a letter, a tile, a rack, or a mode, it is stale: clear it. */
  const clearError = useCallback(() => setError(null), []);

  const stop = useCallback(() => {
    if (!puzzle || !run || result) return;
    services.audio.play('end');
    setAnnouncement('Run stopped.');
    setProgress((prev) => ({
      ...prev,
      [mode]: { ...prev[mode], stopped: true },
    }));
  }, [puzzle, run, result, mode, services]);

  const newEndless = useCallback(() => {
    setError(null);
    setProgress((prev) => ({
      ...prev,
      endless: {
        words: [],
        stopped: false,
        rack: null,
        seed: prev.endless.seed + 1,
      },
    }));
  }, []);

  const switchMode = useCallback((next: Mode) => {
    setError(null);
    setMode(next);
  }, []);

  return {
    mode,
    setMode: switchMode,
    entry: active?.entry ?? null,
    dayNumber: active?.dayNumber ?? null,
    /** The date that selected the rack on screen. The share names THIS, not
     * a fresh clock read. */
    date: active?.date ?? null,
    /** True once the calendar has loaded, so a missing daily can be told
     * apart from a calendar that has not arrived yet. */
    calendarReady: calendar !== null,
    endlessSeed: progress.endless.seed,
    puzzle,
    run,
    result,
    pool,
    restoring,
    ready: !!puzzle,
    /** DERIVED, never read raw. A stored record is the last day played, not
     * a live count: `.length` alone prints a streak that died days ago, and
     * then finishing a run "resets" it, so the game looks like it punishes
     * you for playing. See currentStreak. */
    streak: currentStreak(streakRecord, storageDayIndex(now)),
    announcement,
    error,
    submit,
    stop,
    shuffle,
    clearError,
    newEndless,
  };
}

function playSound(
  services: GameServices,
  puzzle: Puzzle,
  next: RunState,
  word: string,
  poolBefore: number,
) {
  const eights = puzzle.holds.fullRackWords;
  const found = next.played.filter((p) => eights.includes(p.word)).length;
  if (word.length === 8 && eights.length >= 2 && found === eights.length) {
    services.audio.play('all-eights');
  } else if (word.length === 8) {
    services.audio.play('eight');
  } else if (poolBefore === word.length) {
    services.audio.play('hold');
  } else {
    services.audio.play('drop');
  }
}

/** Validate and apply words that were submitted before the dictionary
 * landed. Pure over the previous progress; called from the dictionary
 * promise callback. A queued word that turns out illegal is dropped. */
function flushQueue(
  prev: Progress,
  calendar: Calendar,
  engine: Engine,
  queued: readonly { mode: Mode; word: string }[],
  services: GameServices,
): Progress {
  const next: Progress = { ...prev };
  for (const m of ['daily', 'endless'] as const) {
    const items = queued.filter((q) => q.mode === m);
    if (items.length === 0) continue;
    const slot = entryFor(calendar, m, services.now(), prev[m].seed);
    if (!slot) continue;
    const { entry } = slot;
    const puzzle = engine.createPuzzle(entry.rack);
    const base =
      prev[m].rack === null || prev[m].rack === entry.rack ? prev[m].words : [];
    let run = replay(puzzle, base);
    const words = [...base];
    for (const { word } of items) {
      if (isLegalPlay(puzzle, run, word)) {
        run = applyPlay(puzzle, run, word);
        words.push(word);
      }
    }
    next[m] = { ...next[m], rack: entry.rack, words };
  }
  return next;
}
