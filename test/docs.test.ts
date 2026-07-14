import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The docs described a mechanic that does not exist for ten pull requests:
// the source word, cut by The Cut in GDD v0.4. Documentation that lies about
// the game is the same class of bug as a board that lies about its state, so
// it gets the same treatment: pin it.
const README = readFileSync('README.md', 'utf8');
const CLAUDE = readFileSync('CLAUDE.md', 'utf8');

describe('the docs describe the game that exists', () => {
  it('does not sell the reader a source word', () => {
    // The reader-facing doc must not mention it at all. CLAUDE.md may, but
    // only inside the warning that it is gone, so the next session does not
    // rebuild it from a dead draft.
    expect(README.toLowerCase()).not.toContain('source word');
    expect(README.toLowerCase()).not.toContain('crown');
    expect(CLAUDE).toContain('**There is no source word.**');
  });

  it('does not claim the game is unbuilt', () => {
    for (const doc of [README, CLAUDE]) {
      expect(doc.toLowerCase()).not.toContain('no ui yet');
    }
  });

  it('points at the gdd rather than copying it', () => {
    expect(CLAUDE).toContain('../vault/Projects/Out of Sorts/GDD.md');
  });

  it('carries no em dashes, like everything else here', () => {
    for (const doc of [
      README,
      CLAUDE,
      readFileSync('CONTRIBUTING.md', 'utf8'),
    ]) {
      expect(doc).not.toContain('—');
    }
  });
});
