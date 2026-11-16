import { Score } from "./score";
import type { Subject } from "./subject";
import type { SubjectRegistry } from "./subject-registry";

/** A missing key and `null` both mean "no score": the candidate did not sit that subject. */
export type ScoreMap<C extends string> = Partial<Record<C, Score | null>>;

/**
 * A combination of subjects built from the registry (e.g. group A). It knows
 * which subjects count and what "complete" means; the top 10 query computes
 * the same thing in SQL, with `codes()` supplying the columns (P5).
 */
export class SubjectGroup<C extends string> {
  constructor(
    readonly code: string,
    readonly subjects: readonly Subject<C>[],
  ) {
    if (subjects.length === 0) throw new Error(`Subject group ${code} needs at least one subject`);
    if (new Set(subjects.map((subject) => subject.code)).size !== subjects.length) {
      throw new Error(`Duplicate subject in group ${code}`);
    }
    Object.freeze(this.subjects);
  }

  /** Builds a group by code; an unknown code throws at once rather than shrinking the group. */
  static fromCodes<C extends string>(code: string, registry: SubjectRegistry<C>, codes: readonly string[]): SubjectGroup<C> {
    return new SubjectGroup(
      code,
      codes.map((subjectCode) => {
        if (!registry.has(subjectCode)) throw new Error(`Unknown subject code: ${JSON.stringify(subjectCode)}`);
        return registry.get(subjectCode);
      }),
    );
  }

  codes(): readonly C[] {
    return this.subjects.map((subject) => subject.code);
  }

  /** Every subject has a score. A real 0 counts as present; null or missing does not. */
  isComplete(scores: ScoreMap<C>): boolean {
    return this.subjects.every((subject) => (scores[subject.code] ?? null) !== null);
  }

  /** Exact sum, or null when the candidate is missing any subject of the group. */
  totalOf(scores: ScoreMap<C>): Score | null {
    let total = Score.ZERO;
    for (const subject of this.subjects) {
      const score = scores[subject.code] ?? null;
      if (score === null) return null;
      total = total.plus(score);
    }
    return total;
  }
}
