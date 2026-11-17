import { Score, type ScoreIssue } from "./score";
import { ScoreLevel } from "./score-level";

export type SubjectScoreIssue = ScoreIssue | "OUT_OF_RANGE";
export type RelatedIssue = "EXAM_CODE_WITHOUT_SCORE" | "SCORE_WITHOUT_EXAM_CODE" | "EXAM_CODE_TOO_LONG";

/** `score: null` means the candidate did not sit the subject (an empty cell), which is not 0. */
export type SubjectScoreResult =
  | { readonly ok: true; readonly score: Score | null }
  | { readonly ok: false; readonly reason: SubjectScoreIssue };

/** A raw row as the caller read it (e.g. one CSV record). The domain does not know about CSV. */
export type RawRow = Readonly<Record<string, string>>;

const MAX_SCORE_HUNDREDTHS = 1000; // 10.00; mirrors the score CHECK constraints in the migration

/**
 * One subject. `code` is the single name of the subject: CSV column, database
 * column, Prisma field and JSON key are all the same string.
 * `name` is the Vietnamese fallback for the API; the UI translates by `code`.
 */
export class Subject<C extends string = string> {
  constructor(
    readonly code: C,
    readonly name: string,
  ) {}

  /** "" -> did not sit (null). Otherwise an exact Score in 0..10, or the reason it was refused. */
  parseScore(raw: string): SubjectScoreResult {
    if (raw === "") return { ok: true, score: null };
    const parsed = Score.parse(raw);
    if (!parsed.ok) return parsed;
    if (parsed.score.hundredths > MAX_SCORE_HUNDREDTHS) return { ok: false, reason: "OUT_OF_RANGE" };
    return parsed;
  }

  levelOf(score: Score): ScoreLevel {
    return ScoreLevel.of(score);
  }

  /** Rules that tie this subject to other columns of the same row. Most subjects have none. */
  validateRelated(_score: Score | null, _row: RawRow): RelatedIssue[] {
    return [];
  }
}

/**
 * The foreign-language subject carries an exam code (`ma_ngoai_ngu`) that
 * exists if and only if there is a score (CHECK candidates_ngoai_ngu_code_pair_chk).
 * It does not list the known codes (N1..N7): only presence and the VARCHAR(2) length are checked.
 */
export class ForeignLanguageSubject<C extends string = string> extends Subject<C> {
  readonly examCodeField = "ma_ngoai_ngu";
  static readonly MAX_EXAM_CODE_LENGTH = 2;

  override validateRelated(score: Score | null, row: RawRow): RelatedIssue[] {
    const examCode = row[this.examCodeField] ?? "";
    const issues: RelatedIssue[] = [];
    if (score !== null && examCode === "") issues.push("SCORE_WITHOUT_EXAM_CODE");
    if (score === null && examCode !== "") issues.push("EXAM_CODE_WITHOUT_SCORE");
    if (examCode.length > ForeignLanguageSubject.MAX_EXAM_CODE_LENGTH) issues.push("EXAM_CODE_TOO_LONG");
    return issues;
  }
}
