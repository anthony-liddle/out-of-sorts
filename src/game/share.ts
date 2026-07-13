// The stack is the share graphic. Rows descending, landings where a class
// was mined, a notch marker where two or more letters dropped at once.
// Spoiler-free: shapes and badges, never words. The row widths leak that a
// rack had more than one eight; that is structure-spoilage, accepted
// deliberately, because the taunt is the point.

export interface ShareInput {
  title: string;
  words: readonly { word: string; length: number; score: number }[];
  rackSize: number;
  cleanDescent: boolean;
  /** null on single-eight racks: the badge does not exist there. */
  allEights: { found: number; total: number } | null;
  rank: { name: string; fraction: number };
}

export function buildShare(input: ShareInput): string {
  const rows: string[] = [];
  let poolSize = input.rackSize;
  for (const w of input.words) {
    const notch = w.length < poolSize - 1;
    rows.push(`${notch ? '▼' : ' '}${'█'.repeat(w.length)}`);
    poolSize = w.length;
  }
  const badges: string[] = [];
  if (input.cleanDescent) badges.push('Clean Descent ✓');
  if (input.allEights) {
    badges.push(`All Eights ${input.allEights.found}/${input.allEights.total}`);
  }
  badges.push(
    `${input.rank.name} (${Math.round(input.rank.fraction * 100)}% of par)`,
  );
  return [input.title, '', ...rows, '', badges.join(' | ')].join('\n');
}
