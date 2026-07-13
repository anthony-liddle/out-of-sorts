// The pool: the live letters, always crisp, always the decision surface.
// The most important interaction in the game lives here: as you type, the
// tiles your input would discard go cold, so the tension is visible before
// you commit.
export interface PoolProps {
  letters: string
  input: string
  onTileClick(letter: string): void
}

export function Pool({ letters, input, onTileClick }: PoolProps) {
  const tiles = [...letters]
  const used = new Array<boolean>(tiles.length).fill(false)
  let matchedAll = true
  for (const ch of input.toLowerCase()) {
    const i = tiles.findIndex((t, k) => t === ch && !used[k])
    if (i === -1) {
      matchedAll = false
      continue
    }
    used[i] = true
  }
  const typing = input.length > 0
  return (
    <div className="pool" role="group" aria-label="Letter pool">
      {tiles.map((letter, i) => {
        const state = !typing ? undefined : used[i] ? 'used' : 'cold'
        return (
          <button
            key={i}
            type="button"
            className="tile pool-tile"
            data-testid="pool-tile"
            data-state={state}
            aria-pressed={state === 'used'}
            onClick={() => onTileClick(letter)}
          >
            {letter.toUpperCase()}
          </button>
        )
      })}
      {typing && !matchedAll && (
        <span className="visually-hidden" role="status">
          Some typed letters are not in the pool.
        </span>
      )}
    </div>
  )
}
