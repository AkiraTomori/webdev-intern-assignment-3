import { Score } from "./score";

export type ScoreLevelKey = "gte8" | "gte6" | "gte4" | "lt4";

/**
 * The four score levels and their boundaries, in one place. Intervals are
 * half-open: min is inclusive, max is exclusive, null means unbounded. `key`
 * and `label` are what the API returns; the UI translates by `key`.
 */
export class ScoreLevel {
  private constructor(
    readonly key: ScoreLevelKey,
    readonly label: string,
    readonly min: Score | null,
    readonly max: Score | null,
  ) {}

  /** Highest level first. */
  static readonly all: readonly ScoreLevel[] = Object.freeze([
    new ScoreLevel("gte8", "≥ 8", threshold("8"), null),
    new ScoreLevel("gte6", "6 ≤ x < 8", threshold("6"), threshold("8")),
    new ScoreLevel("gte4", "4 ≤ x < 6", threshold("4"), threshold("6")),
    new ScoreLevel("lt4", "< 4", null, threshold("4")),
  ]);

  /** A subject that was not sat has no score, so no level: null is rejected by the type. */
  static of(score: Score): ScoreLevel {
    const level = ScoreLevel.all.find((candidate) => candidate.contains(score));
    if (!level) throw new Error(`No score level contains ${score.toString()}`); // unreachable while the invariant holds
    return level;
  }

  contains(score: Score): boolean {
    const aboveMin = this.min === null || score.compareTo(this.min) >= 0;
    const belowMax = this.max === null || score.compareTo(this.max) < 0;
    return aboveMin && belowMax;
  }
}

function threshold(raw: string): Score {
  const result = Score.parse(raw);
  if (!result.ok) throw new Error(`Invalid score level threshold: ${raw}`);
  return result.score;
}

// Invariant checked when the module loads: adjacent, non-overlapping, covering everything.
(function assertLevelsAreContiguous(levels: readonly ScoreLevel[]): void {
  const first = levels[0];
  const last = levels[levels.length - 1];
  if (!first || !last || first.max !== null || last.min !== null) {
    throw new Error("Score levels must be unbounded at both ends");
  }
  for (let i = 0; i < levels.length - 1; i++) {
    const upper = levels[i]!;
    const lower = levels[i + 1]!;
    if (upper.min === null || lower.max === null || upper.min.compareTo(lower.max) !== 0) {
      throw new Error(`Score levels ${upper.key} and ${lower.key} are not adjacent`);
    }
  }
})(ScoreLevel.all);
