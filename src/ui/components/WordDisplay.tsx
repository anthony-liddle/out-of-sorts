// The word you are building. A DISPLAY, never an input: a real text field
// needs focus (so you cannot just start typing) and raises the OS keyboard
// on a phone, covering the board with a keyboard the tiles already replace.
//
// It is not an inert div either. It carries the current word for assistive
// technology, announced as it changes, so a screen reader user can hear what
// they have built.
export interface WordDisplayProps {
  word: string;
  error: string | null;
}

export function WordDisplay({ word, error }: WordDisplayProps) {
  return (
    <div className="word-display-wrap">
      <p
        className="word-display"
        data-testid="word-display"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-label={word ? `Word: ${word.toUpperCase()}` : 'No word yet'}
      >
        {word ? (
          word.toUpperCase()
        ) : (
          <span className="word-hint" aria-hidden="true">
            Pick your letters
          </span>
        )}
      </p>
      {error && (
        <p className="entry-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
