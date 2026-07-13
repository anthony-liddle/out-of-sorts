// The stack: words played, descending, centered and nested so the
// silhouette reads. Landings where a whole anagram class was mined; a notch
// where two or more letters dropped at once. The notch is a shape, not a
// color: the gap says it, and no accent color may mark it.
import type { PlayedWord } from '../../engine/run'

export interface StackProps {
  words: readonly PlayedWord[]
  rackSize: number
}

export function Stack({
  words,
  rackSize,
  ghosted = false,
  testId,
}: StackProps) {
  return (
    <ol
      className="stack"
      data-testid={testId ?? 'stack'}
      data-ghosted={ghosted || undefined}
      aria-label={ghosted ? 'A possible run' : 'Words played'}
    >
      {words.map((w, i) => {
        const poolBefore = i === 0 ? rackSize : words[i - 1]!.length
        const notch = w.length < poolBefore - 1
        const landing = i > 0 && words[i - 1]!.length === w.length
        return (
          <li
            key={`${w.word}-${i}`}
            className="stack-row"
            data-testid="stack-row"
            data-notch={notch || undefined}
            data-landing={landing || undefined}
            data-eight={w.length === 8 || undefined}
            style={{ width: `${(w.length / rackSize) * 100}%` }}
          >
            {notch && (
              <span className="notch" aria-label="dropped more than one letter">
                ▼
              </span>
            )}
            <span className="stack-word">{w.word.toUpperCase()}</span>
            <span className="stack-score">{w.score}</span>
          </li>
        )
      })}
    </ol>
  )
}
