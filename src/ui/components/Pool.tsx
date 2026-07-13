// The pool: the live letters, always crisp, always the decision surface.
// The most important interaction in the game lives here: as you type, the
// tiles your input would discard go cold, so the tension is visible before
// you commit.
//
// Two subtleties, both learned from play:
// - Duplicate letters: a clicked tile lights THAT tile. Typed letters fall
//   back to first unused match, and typing around a clicked tile never
//   steals its light (see reconcileSelection).
// - The cold preview waits for a playable length. Below three letters no
//   legal word exists, so there is no discard set to preview, and chilling
//   seven tiles on the first keystroke reads as the board deselecting.
import { MIN_WORD_LENGTH } from '../../engine/types'

export interface PoolProps {
  letters: string
  input: string
  /** Tile index per input letter; -1 for a typed letter with no tile. */
  selection: readonly number[]
  onTileClick(letter: string, index: number): void
}

/**
 * Map input letters to tile indexes. Clicked tiles arrive with their exact
 * index; typed letters are matched to the first unused tile. Appends and
 * deletions preserve the existing assignment; any other edit recomputes
 * from scratch.
 */
export function reconcileSelection(
  letters: string,
  prevInput: string,
  nextInput: string,
  prevSelection: readonly number[],
): number[] {
  if (nextInput.startsWith(prevInput)) {
    const selection = [...prevSelection.slice(0, prevInput.length)]
    for (const ch of nextInput.slice(prevInput.length).toLowerCase()) {
      selection.push(firstUnused(letters, ch, selection))
    }
    return selection
  }
  if (prevInput.startsWith(nextInput)) {
    return [...prevSelection.slice(0, nextInput.length)]
  }
  const selection: number[] = []
  for (const ch of nextInput.toLowerCase()) {
    selection.push(firstUnused(letters, ch, selection))
  }
  return selection
}

function firstUnused(
  letters: string,
  ch: string,
  taken: readonly number[],
): number {
  for (let i = 0; i < letters.length; i++) {
    if (letters[i] === ch && !taken.includes(i)) return i
  }
  return -1
}

export function Pool({ letters, input, selection, onTileClick }: PoolProps) {
  const used = new Set(selection.filter((i) => i >= 0))
  const previewing = input.length >= MIN_WORD_LENGTH
  const unmatched = selection.some((i) => i === -1)
  return (
    <div className="pool" data-testid="pool" role="group" aria-label="Letter pool">
      {[...letters].map((letter, i) => {
        const state = used.has(i)
          ? 'used'
          : previewing
            ? 'cold'
            : undefined
        return (
          <button
            key={i}
            type="button"
            className="tile pool-tile"
            data-testid="pool-tile"
            data-state={state}
            aria-pressed={state === 'used'}
            onClick={() => {
              if (!used.has(i)) onTileClick(letter, i)
            }}
          >
            {letter.toUpperCase()}
          </button>
        )
      })}
      {input.length > 0 && unmatched && (
        <span className="visually-hidden" role="status">
          Some typed letters are not in the pool.
        </span>
      )}
    </div>
  )
}
