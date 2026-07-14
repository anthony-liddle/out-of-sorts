// The footer: who made this, what it stands on, and where to learn the
// rules. Something at the bottom of the page that says the page is done.
export function Footer() {
  return (
    <footer className="footer">
      <nav className="footer-nav">
        <a href="#how">How it works</a>
      </nav>
      <p className="footer-credit">
        Words validated against ENABLE and{' '}
        <a href="http://wordlist.aspell.net/">SCOWL</a>, public domain. Set in
        Baloo 2 and Nunito.
      </p>
      {/* The dedication is Antoine's line to write, not ours. The slot
          waits for it. */}
      <p className="dedication" data-testid="dedication"></p>
    </footer>
  );
}
