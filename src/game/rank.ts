// Rank: greed, graded. Score as a fraction of par. Points past the top
// threshold overflow the bar but unlock no higher rank.
//
// PLAYTEST-SHAPED: the GDD deliberately leaves tier names and thresholds
// open. These are provisional, in the ghosts register, and expected to be
// retuned against real racks. Order matters: highest first.
export interface RankTier {
  min: number;
  name: string;
}

export const RANK_TIERS: readonly RankTier[] = [
  { min: 1.0, name: 'At Rest' },
  { min: 0.85, name: 'Haunting' },
  { min: 0.7, name: 'Gliding' },
  { min: 0.5, name: 'Drifting' },
  { min: 0.3, name: 'Stirring' },
  { min: 0, name: 'Faint' },
];

export interface Rank {
  name: string;
  fraction: number;
}

export function rankFor(score: number, par: number): Rank {
  const fraction = par > 0 ? score / par : 0;
  const tier =
    RANK_TIERS.find((t) => fraction >= t.min) ??
    RANK_TIERS[RANK_TIERS.length - 1]!;
  return { name: tier.name, fraction };
}
