# Dates And Dead Streaks

Two unrelated changes of one kind: a display claiming something the state
does not support.

## 1. The streak displays a corpse

### The defect

`advanceStreak` is correct. It encodes aliveness as
`current.lastDayIndex === dayIndex - 1` and resets to 1 otherwise. But that
rule lives inside the mutation, and the display never asks it:

```ts
streak: loadJson<Streak>(services.storage, 'streak')?.length ?? 0;
```

A stored `{lastDayIndex: 6, length: 3}` on day 9 prints Streak 3. It died on
day 8. Finishing today's run then resets it to 1, so the game reads as
punishing the player for playing. The lie is exposed by the one action that
should have been rewarded.

Two places reason about "is this streak alive" and only one of them does it.
That is the defect. The wrong number is a symptom.

### The fix: one predicate, two consumers

`src/game/streak.ts` grows a single exported aliveness question:

```
streakSurvivesTo(stored, dayIndex)
  -> stored !== undefined
     && (stored.lastDayIndex === dayIndex || stored.lastDayIndex === dayIndex - 1)
```

Both consumers call it and neither re-derives it:

- `currentStreak(stored, todayIndex)` returns `stored.length` when it
  survives, otherwise `0`.
- `advanceStreak(stored, dayIndex)` returns `{dayIndex, length: 1}` when it
  does not survive; otherwise the record unchanged if `lastDayIndex` is
  already `dayIndex` (idempotent within a day), else the length incremented.

Display and advancement cannot drift, because the question is asked in
exactly one place. Pinned by a test sweeping day gaps.

Played yesterday counts as alive: the streak is not lost until the day is.

### The second defect: read during render

The storage read sits in the hook body, so when the end-of-run effect writes
a new value nothing re-renders and the end screen can show the pre-run
streak until some unrelated interaction forces a paint.

The record moves into `useState`, lazily initialised from storage once. The
render path derives from state. The end-of-run effect advances from the
in-state record (not a fresh storage read), saves, and sets state, so the
new value paints immediately with no second interaction and no reload.

### The zero case, and the guard

Decided: hide at 0, show from 1.

The header guard is today `game.streak > 1`, which hides 0 and 1 alike. It
becomes `> 0`. This is a behaviour change, not a refactor, and is called out
as its own decision in the PR: a streak of 1 becomes visible where it was
previously hidden until day 2.

It is correct because the reason to hide 1 was never stated, and hiding it
makes a player's first completed daily look like it did not count. A dead
streak derives to 0 and disappears entirely: nothing to show, no scolding,
which is the register the GDD asks for. A fresh Streak 1 after a break now
reads as something earned rather than a demotion, because the lie that
preceded it is gone.

## 2. The share says the date

`Day N` is derived from the calendar epoch, which the GDD calls movable and
which has already moved once. Every share issued before that move now points
at a different rack. The date is the canonical key; `Day N` is a lossy
re-encoding of it, and the rack is literally `rackForDate(calendar, now)`.

Naming the date also makes local midnight correct without explanation (each
player gets their own local date and says so), requires no epoch freeze, and
stops advertising the game's age.

The trade that makes it work: shares are consumed same-day. The identifier
only needs to be stable for a day or two.

### The date must come from the same source as the rack

Not a fresh `services.now()` at share time. A run played at 23:58 and
finished at 00:01 would otherwise name a day whose rack was never played:
one fact, two places, which is the same shape as every other bug here.

`entryFor` already receives the `now` that selects the rack and currently
discards it after computing `dayNumber`. It returns it instead, so the date
is a property of the resolved entry and flows to the share from there.

The invariant under test is that **the share date names the date that
selected the rack currently on screen**. Not that the rack is stable across
midnight: `active` is memoized on `[calendar, mode, progress]` and a play at
00:01 legitimately re-resolves it, and changing that would be rack
selection, which is out of scope.

### Format

`July 14`. Local `getFullYear/getMonth/getDate` against a literal month
table, never `toISOString` or anything UTC-flavoured, because `rackForDate`
picks from local components and a UTC-derived date contradicts the rack near
midnight. The year is skipped: same-day shares do not need it.

### Presentation

The single overloaded `dayLabel` in `App.tsx` serves three jobs and splits
by job:

- `boardLabel`: `null` on daily, `Endless N` on endless. The daily board
  renders no label, buying back vertical space above the rack.
- `shareTitle`: `Out of Sorts · July 14`, or `Out of Sorts · Endless 1`.
- The end screen line becomes `68 points · par 95` on daily. The identifier
  exists to be a shared reference and the share carries it; on your own end
  screen you already know what day it is. Endless keeps its prefix, so
  `EndScreen` takes `label: string | null`.

Endless keeps its board label. `Endless N` is a session counter, not an
epoch-derived alias, so it is not the thing being fixed.

`dayNumber` stays in the engine and the calendar. It is the array index and
it is correct there. This is a presentation change only.

## Tests, written first

Streak, against real day gaps and not synthetic fixtures alone:

- Played today displays `length`.
- Played yesterday, not today, displays `length`.
- Played two days ago displays 0. Played five days ago displays 0.
- Finishing a run never lowers the displayed streak: assert 0 to 1 across a
  broken streak, never 3 to 1. **Asserted on the hook value, not the DOM.**
  The bug lives in the value, and a DOM assertion silently changes meaning
  when the guard changes: under `> 0` it pins the bug, under `> 1` it
  degenerates to absent-to-absent and pins nothing while still passing. The
  DOM assertion is written too, as a second check rather than the
  load-bearing one.
- The displayed streak updates immediately when a run ends, with no second
  interaction and no reload.
- Display and advancement agree across a sweep of day gaps, so they cannot
  drift.

Share and board:

- The board renders no `DAY N` label at any width.
- The share text contains the date and no day number.
- An Endless share still reads `Endless N`.
- The share contains no words from the run.
- The share date agrees with the date that selected the rack, across a
  midnight boundary.

## Scope

Untouched: `rackForDate`, the calendar, both epochs, rack selection, the
marque, the stack, the haunt, the tiles, the cold preview, the ceremony,
How It Works, the cold start, keyboard capture, the restore gate, the
two-row control layout. The calendar epoch stays movable; that is the point.
