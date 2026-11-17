import { describe, expect, it } from "vitest";
import { checkHeader, parseCandidateRow } from "../../../database/seed/candidate-row";

const HEADER = "sbd,toan,ngu_van,ngoai_ngu,vat_li,hoa_hoc,sinh_hoc,lich_su,dia_li,gdcd,ma_ngoai_ngu";

const fieldsOf = (line: string) => line.split(",");

function reasons(line: string): string[] {
  const result = parseCandidateRow(fieldsOf(line), 2);
  if (result.ok) throw new Error(`expected "${line}" to be rejected`);
  return result.issues.map((issue) => (issue.subject ? `${issue.reason}:${issue.subject}` : issue.reason));
}

describe("parseCandidateRow", () => {
  it("keeps the leading zero of the SBD and turns empty cells into null", () => {
    const result = parseCandidateRow(fieldsOf("01000001,8.4,6.75,8.0,6.0,5.25,5.0,,,,N1"), 2);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(result.row.sbd).toBe("01000001");
    expect(result.row.scores.toan?.toString()).toBe("8.4");
    expect(result.row.scores.ngoai_ngu?.toString()).toBe("8");
    expect(result.row.scores.lich_su).toBeNull();
    expect(result.row.scores.dia_li).toBeNull();
    expect(result.row.scores.gdcd).toBeNull();
    expect(result.row.maNgoaiNgu).toBe("N1");
  });

  it("a real 0 is a score, not null", () => {
    const result = parseCandidateRow(fieldsOf("01000003,0,5,,,,,,,,"), 2);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(result.row.scores.toan?.toString()).toBe("0");
    expect(result.row.scores.ngoai_ngu).toBeNull();
    expect(result.row.maNgoaiNgu).toBeNull();
  });

  it("rejects an SBD that is not exactly 8 digits", () => {
    expect(reasons("1000001,8.4,,,,,,,,,")).toEqual(["INVALID_SBD"]);
    expect(reasons("010000011,8.4,,,,,,,,,")).toEqual(["INVALID_SBD"]);
    expect(reasons("0100000A,8.4,,,,,,,,,")).toEqual(["INVALID_SBD"]);
  });

  it.each([
    ["10.5", "OUT_OF_RANGE"],
    ["abc", "NOT_A_NUMBER"],
    ["8.255", "TOO_MANY_DECIMALS"],
  ])("rejects score %s with %s and names the subject", (raw, reason) => {
    expect(reasons(`01000001,${raw},,,,,,,,,`)).toEqual([`${reason}:toan`]);
  });

  it("a foreign-language score needs an exam code, and the reverse", () => {
    expect(reasons("01000001,,,8.0,,,,,,,")).toEqual(["SCORE_WITHOUT_EXAM_CODE:ngoai_ngu"]);
    expect(reasons("01000001,,,,,,,,,,N1")).toEqual(["EXAM_CODE_WITHOUT_SCORE:ngoai_ngu"]);
    expect(reasons("01000001,,,8.0,,,,,,,N10")).toEqual(["EXAM_CODE_TOO_LONG:ngoai_ngu"]);
  });

  it("reports every problem of a row, not only the first", () => {
    expect(reasons("1,abc,11,,,,,,,,")).toEqual(["INVALID_SBD", "NOT_A_NUMBER:toan", "OUT_OF_RANGE:ngu_van"]);
  });

  it("rejects a row without exactly 11 fields", () => {
    expect(reasons("01000001,8.4,,,,,,,,")).toEqual(["COLUMN_COUNT"]);
    expect(reasons("01000001,8.4,,,,,,,,,N1,")).toEqual(["COLUMN_COUNT"]);
  });

  it("rejects a quoted field instead of misreading it", () => {
    expect(reasons('01000001,"8.4",,,,,,,,,')).toEqual(["QUOTED_FIELD"]);
  });

  it("carries the CSV line number on every issue", () => {
    const result = parseCandidateRow(fieldsOf("1,,,,,,,,,,"), 4242);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.every((issue) => issue.lineNo === 4242)).toBe(true);
  });
});

describe("checkHeader", () => {
  it("accepts the header in registry order", () => {
    expect(checkHeader(fieldsOf(HEADER))).toEqual({ ok: true });
  });

  it("rejects swapped, missing and extra columns", () => {
    const swapped = "sbd,ngu_van,toan,ngoai_ngu,vat_li,hoa_hoc,sinh_hoc,lich_su,dia_li,gdcd,ma_ngoai_ngu";
    expect(checkHeader(fieldsOf(swapped)).ok).toBe(false);
    expect(checkHeader(fieldsOf("sbd,toan")).ok).toBe(false);
    expect(checkHeader(fieldsOf(`${HEADER},extra`)).ok).toBe(false);
  });
});
