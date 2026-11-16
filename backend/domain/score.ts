// Pure TypeScript: nothing in domain/ imports from outside domain/.

export type ScoreIssue = "NOT_A_NUMBER" | "TOO_MANY_DECIMALS";

export type ScoreParseResult =
  | { readonly ok: true; readonly score: Score }
  | { readonly ok: false; readonly reason: ScoreIssue };

const SCORE_PATTERN = /^(\d+)(?:\.(\d+))?$/;

/**
 * An exact, non-negative score stored as whole hundredths (8.4 -> 840).
 * Binary floating point cannot add scores reliably (9.1 + 9.2 + 9.3 is
 * 27.599999999999998), so every sum stays in integers. There is no upper cap
 * here: group totals reach 30. The 0..10 range is each subject's rule.
 */
export class Score {
  static readonly ZERO = new Score(0);

  private constructor(readonly hundredths: number) {}

  /** Format and decimal places only: "0", "10", "8.4", "6.75", "28.6". Never trims, never rounds. */
  static parse(raw: string): ScoreParseResult {
    const match = SCORE_PATTERN.exec(raw);
    if (!match) return { ok: false, reason: "NOT_A_NUMBER" };
    const [, integerPart = "", fraction = ""] = match;
    if (fraction.length > 2) return { ok: false, reason: "TOO_MANY_DECIMALS" };
    const hundredths = Number(integerPart) * 100 + Number(fraction.padEnd(2, "0"));
    if (!Number.isSafeInteger(hundredths)) return { ok: false, reason: "NOT_A_NUMBER" };
    return { ok: true, score: new Score(hundredths) };
  }

  plus(other: Score): Score {
    return new Score(this.hundredths + other.hundredths);
  }

  compareTo(other: Score): number {
    return this.hundredths - other.hundredths;
  }

  /** For JSON: the nearest double of an exact hundredths value, e.g. 2860 -> 28.6. */
  toNumber(): number {
    return this.hundredths / 100;
  }

  /** Shortest exact decimal form, no trailing zeros: "8.4", "10", "0.05". */
  toString(): string {
    const whole = Math.floor(this.hundredths / 100);
    const fraction = this.hundredths % 100;
    if (fraction === 0) return String(whole);
    return `${whole}.${String(fraction).padStart(2, "0").replace(/0$/, "")}`;
  }
}
