// The stack: words played, descending, centered and nested so the
// silhouette reads. Landings where a whole anagram class was mined; a notch
// where two or more letters dropped at once. The notch is a shape, not a
// color: the gap says it, and no accent color may mark it.
import type React from 'react'
import type { PlayedWord } from '../../engine/run'

export interface StackProps {
  words: readonly PlayedWord[]
  rackSize: number
  /** Ghosted rendering for the end screen's what-was-possible comparison. */
  ghosted?: boolean
  testId?: string
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
      style={
        {
          // One unit of width per letter, shared by every stack on the
          // screen: the same word is the same width in every column, which
          // is the entire basis of the side by side comparison.
          '--stack-unit': `calc(var(--stack-width) / ${rackSize})`,
        } as React.CSSProperties
      }
      data-testid={testId ?? 'stack'}
      data-ghosted={ghosted || undefined}
      aria-label={ghosted ? 'A possible run' : 'Words played'}
    >
      {words.map((w, i) => {
        const poolBefore = i === 0 ? rackSize : words[i - 1]!.length
        const notch = w.length < poolBefore - 1
        const landing = i > 0 && words[i - 1]!.length === w.length
        // A landing is marked on both of its rows so the pair can fuse
        // into one tier by shape: the head flattens its bottom corners,
        // the landing row its top ones.
        const landingHead =
          i + 1 < words.length && words[i + 1]!.length === w.length
        return (
          <li
            key={`${w.word}-${i}`}
            className="stack-row"
            data-testid="stack-row"
            data-notch={notch || undefined}
            data-landing={landing || undefined}
            data-landing-head={landingHead || undefined}
            data-eight={w.length === 8 || undefined}
          >
            {/* The pill is a LENGTH BAR and nothing else. It cannot also be
                a content container: a three letter pill has no room for a
                word and a number, and widening it would lie about the word's
                length, which is the silhouette the whole share graphic and
                both comparison stacks rest on. */}
            <span
              className="stack-pill"
              style={{ width: `calc(${w.length} * var(--stack-unit))` }}
            >
              <span className="stack-word">{w.word.toUpperCase()}</span>
            </span>
            {/* The score lives in a fixed gutter, at the same x on every
                row whatever the pill does. */}
            <span className="stack-score">{w.score}</span>
          </li>
        )
      })}
    </ol>
  )
}
