// The stack: words played, descending and narrowing. Landings where a whole
// anagram class was mined, a visible notch where two or more letters were
// dropped at once. Not a clean pyramid, and it scrolls.
import type { PlayedWord } from '../../engine/run'

export interface StackProps {
  words: readonly PlayedWord[]
  rackSize: number
}

export function Stack({ words, rackSize }: StackProps) {
  return (
    <ol className="stack" aria-label="Words played">
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
