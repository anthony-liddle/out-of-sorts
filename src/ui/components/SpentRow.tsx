// The spent row: the letters you lose stay on screen. Parked, not deleted.
// Each ghost carries the play index that spent it (the engine's decay
// primitive); the UI renders age from it and never computes it. The fade is
// decoration on already-played content and must never be the only signal:
// the letter itself always stays readable.
import type { SpentLetter } from '../../engine/run'

export interface SpentRowProps {
  spent: readonly SpentLetter[]
  currentPlayCount: number
  reducedMotion: boolean
}

export function SpentRow({
  spent,
  currentPlayCount,
  reducedMotion,
}: SpentRowProps) {
  return (
    <div className="spent-row" role="group" aria-label="Spent letters">
      {spent.map((s, i) => {
        const age = currentPlayCount - 1 - s.playIndex
        const opacity = reducedMotion ? 1 : Math.max(0.4, 1 - age * 0.1)
        return (
          <span
            key={i}
            className="ghost"
            data-testid="ghost"
            data-play-index={s.playIndex}
            data-motion={reducedMotion ? 'off' : 'on'}
            style={reducedMotion ? undefined : { opacity }}
          >
            <span className="ghost-body" aria-hidden="true" />
            <span className="ghost-letter">{s.letter.toUpperCase()}</span>
          </span>
        )
      })}
    </div>
  )
}
