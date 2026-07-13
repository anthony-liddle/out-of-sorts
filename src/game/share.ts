// The stack is the share graphic. Rows descending, landings where a class
// was mined, the notch visible as the width gap itself: no glyph, no color,
// the silhouette says it. The ghosts go in it: one per spent letter, the
// identity of the game in the one artifact that leaves the app.
// Spoiler-free: shapes and badges, never words. The row widths leak that a
// rack had more than one eight; that is structure-spoilage, accepted
// deliberately, because the taunt is the point.

export interface ShareInput {
  title: string;
  words: readonly { word: string; length: number; score: number }[];
  rackSize: number;
  spentCount: number;
  cleanDescent: boolean;
  /** null on single-eight racks: the badge does not exist there. */
  allEights: { found: number; total: number } | null;
  rank: { name: string; fraction: number };
  score: number;
  par: number;
}

export function buildShare(input: ShareInput): string {
  const rows = input.words.map((w) => '█'.repeat(w.length));
  const badges: string[] = [];
  if (input.cleanDescent) badges.push('Clean Descent ✓');
  if (input.allEights) {
    badges.push(`All Eights ${input.allEights.found}/${input.allEights.total}`);
  }
  badges.push(input.rank.name);
  badges.push(`${input.score} of par ${input.par}`);
  const lines = [input.title, '', ...rows];
  if (input.spentCount > 0) {
    lines.push('', '👻'.repeat(input.spentCount));
  }
  lines.push('', badges.join(' · '));
  return lines.join('\n');
}
