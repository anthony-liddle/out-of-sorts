// How it works: the rules, in the voice. Gentle, plain, a little sad, and
// every line survives being explained to someone who asks. The reveal
// stays the end screen's: nothing here mentions par, rank, or the eights.
export function HowItWorks() {
  return (
    <section className="how" data-testid="how-it-works">
      <h2>How it works</h2>
      <ul className="how-rules">
        <li>You start with eight letters. They are everything you get.</li>
        <li>
          Spend a word of three letters or more. The letters you used become
          your new pool.
        </li>
        <li>
          <strong>Every letter you don't use is gone.</strong> For good.
        </li>
        <li>
          No word twice. When nothing playable remains, the run is over: you
          are out of sorts.
        </li>
        <li>
          Every word scores its letters. A letter you keep scores again in
          each word it survives, so the letters you protect are the score
          you build.
        </li>
        <li>You can stop whenever you like, and rest early.</li>
      </ul>
      <p className="how-daily">
        One puzzle a day, the same eight letters for everyone. Endless is
        there for when one is not enough.
      </p>
      <a className="how-back" href="#">
        Back to the game
      </a>
    </section>
  );
}
