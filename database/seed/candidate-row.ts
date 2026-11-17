import { subjects, type RawRow, type Score, type SubjectCode } from "../../backend/domain";
import { sbdSchema } from "../../backend/schema/sbd";
import type { NewCandidate } from "../../backend/model/candidate-model";

// Pure: no fs, no Prisma. One CSV record in, a validated candidate or every reason it was refused out.

export const EXAM_CODE_COLUMN = "ma_ngoai_ngu";
export const EXPECTED_HEADER: readonly string[] = ["sbd", ...subjects.codes(), EXAM_CODE_COLUMN];

export type RowIssueReason =
  | "QUOTED_FIELD"
  | "COLUMN_COUNT"
  | "INVALID_SBD"
  | "NOT_A_NUMBER"
  | "TOO_MANY_DECIMALS"
  | "OUT_OF_RANGE"
  | "EXAM_CODE_WITHOUT_SCORE"
  | "SCORE_WITHOUT_EXAM_CODE"
  | "EXAM_CODE_TOO_LONG";

export interface RowIssue {
  readonly lineNo: number;
  readonly reason: RowIssueReason;
  /** Subject code, for issues that belong to one subject. */
  readonly subject?: SubjectCode;
}

export type RowParseResult =
  | { readonly ok: true; readonly row: NewCandidate }
  | { readonly ok: false; readonly issues: readonly RowIssue[] };

export function checkHeader(fields: readonly string[]): { ok: true } | { ok: false; message: string } {
  const same = fields.length === EXPECTED_HEADER.length && fields.every((field, i) => field === EXPECTED_HEADER[i]);
  if (same) return { ok: true };
  return { ok: false, message: `CSV header must be exactly: ${EXPECTED_HEADER.join(",")}` };
}

/** `lineNo` is the 1-based line in the file (header is line 1). */
export function parseCandidateRow(fields: readonly string[], lineNo: number): RowParseResult {
  // Plain split(",") is only correct without quoted cells, so refuse them rather than misread.
  if (fields.some((field) => field.includes('"'))) return { ok: false, issues: [{ lineNo, reason: "QUOTED_FIELD" }] };
  if (fields.length !== EXPECTED_HEADER.length) return { ok: false, issues: [{ lineNo, reason: "COLUMN_COUNT" }] };

  const raw: RawRow = Object.fromEntries(EXPECTED_HEADER.map((name, i) => [name, fields[i] ?? ""]));
  const issues: RowIssue[] = [];

  const sbd = raw.sbd ?? "";
  if (!sbdSchema.safeParse(sbd).success) issues.push({ lineNo, reason: "INVALID_SBD" });

  const scores = {} as Record<SubjectCode, Score | null>;
  for (const subject of subjects.all()) {
    const parsed = subject.parseScore(raw[subject.code] ?? "");
    if (!parsed.ok) {
      issues.push({ lineNo, reason: parsed.reason, subject: subject.code });
      continue;
    }
    scores[subject.code] = parsed.score;
    for (const reason of subject.validateRelated(parsed.score, raw)) {
      issues.push({ lineNo, reason, subject: subject.code });
    }
  }

  if (issues.length > 0) return { ok: false, issues };
  const examCode = raw[EXAM_CODE_COLUMN] ?? "";
  return { ok: true, row: { sbd, scores, maNgoaiNgu: examCode === "" ? null : examCode } };
}
