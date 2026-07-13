// The drift: what you lost, rising and fading above the pool. The oldest
// ghosts are nearly gone. Age comes from the engine's play index; the UI
// reads it and never computes it. The fade is decoration on already-played
// content and must never be the only signal: the letters stay readable and
// reduced motion suppresses drift and decay entirely.
import type { SpentLetter } from '../../engine/run'

export interface DriftProps {
  spent: readonly SpentLetter[]
  currentPlayCount: number
  reducedMotion: boolean
}

export function Drift({ spent, currentPlayCount, reducedMotion }: DriftProps) {
  const oldestFirst = [...spent].sort((a, b) => a.playIndex - b.playIndex)
  return (
    <div className="drift" data-testid="drift" role="group" aria-label="Spent letters">
      {oldestFirst.length === 0 ? (
        <p className="drift-empty">Nothing lost yet.</p>
      ) : (
        oldestFirst.map((s, i) => {
          const age = currentPlayCount - 1 - s.playIndex
          const opacity = reducedMotion
            ? 1
            : Math.max(0.25, 1 - age * 0.12)
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
        })
      )}
    </div>
  )
}
