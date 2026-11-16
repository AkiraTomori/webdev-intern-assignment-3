import { describe, expect, it } from "vitest";
import { ForeignLanguageSubject, Subject } from "../../domain/subject";
import { s } from "./helpers";

const toan = new Subject("toan", "Toán");
const ngoaiNgu = new ForeignLanguageSubject("ngoai_ngu", "Ngoại ngữ");

describe("Subject.parseScore", () => {
  it("GS-01-AC03: an empty cell is 'did not sit' (null), not 0", () => {
    expect(toan.parseScore("")).toEqual({ ok: true, score: null });
    const zero = toan.parseScore("0");
    expect(zero.ok && zero.score?.toString()).toBe("0");
    expect(toan.parseScore("")).not.toEqual(toan.parseScore("0"));
  });

  it.each(["10", "0", "8.4", "6.75", "10.00", "0.00"])("GS-01-AC06: accepts %s", (raw) => {
    const result = toan.parseScore(raw);
    expect(result.ok).toBe(true);
    expect(result.ok && result.score).not.toBeNull();
  });

  it.each([
    ["8.255", "TOO_MANY_DECIMALS"],
    ["10.25", "OUT_OF_RANGE"],
    ["10.01", "OUT_OF_RANGE"],
    ["11", "OUT_OF_RANGE"],
    ["-1", "NOT_A_NUMBER"],
    ["abc", "NOT_A_NUMBER"],
    [" 8", "NOT_A_NUMBER"],
    [" ", "NOT_A_NUMBER"],
  ])("GS-01-AC06: rejects %j with %s", (raw, reason) => {
    expect(toan.parseScore(raw)).toEqual({ ok: false, reason });
  });

  it("GS-05-AC01: the 0..10 range is the subject's rule, 10 is accepted and 10.01 is not", () => {
    expect(toan.parseScore("10").ok).toBe(true);
    expect(toan.parseScore("10.01").ok).toBe(false);
  });

  it("GS-03-AC01: levelOf delegates to ScoreLevel", () => {
    expect(toan.levelOf(s("8")).key).toBe("gte8");
    expect(toan.levelOf(s("3.99")).key).toBe("lt4");
  });
});

describe("Subject.validateRelated", () => {
  it("a subject with no related columns reports nothing for any row", () => {
    expect(toan.validateRelated(s("8"), { ma_ngoai_ngu: "N1" })).toEqual([]);
    expect(toan.validateRelated(null, {})).toEqual([]);
  });
});

describe("ForeignLanguageSubject.validateRelated (mirrors candidates_ngoai_ngu_code_pair_chk)", () => {
  it.each([
    ["score + code", s("8"), "N1", []],
    ["no score + no code", null, "", []],
    ["score, no code", s("8"), "", ["SCORE_WITHOUT_EXAM_CODE"]],
    ["no score, code", null, "N1", ["EXAM_CODE_WITHOUT_SCORE"]],
    ["score + code of 3 chars", s("8"), "N10", ["EXAM_CODE_TOO_LONG"]],
    ["no score + code of 3 chars", null, "N10", ["EXAM_CODE_WITHOUT_SCORE", "EXAM_CODE_TOO_LONG"]],
    ["score of 0 is a real score and needs a code", s("0"), "", ["SCORE_WITHOUT_EXAM_CODE"]],
  ])("DB1 §3.4 / Q-04: %s", (_label, score, code, expected) => {
    expect(ngoaiNgu.validateRelated(score, { ma_ngoai_ngu: code })).toEqual(expected);
  });

  it("treats a missing ma_ngoai_ngu key as an empty cell", () => {
    expect(ngoaiNgu.validateRelated(s("8"), {})).toEqual(["SCORE_WITHOUT_EXAM_CODE"]);
    expect(ngoaiNgu.validateRelated(null, {})).toEqual([]);
  });

  it("Q-04: does not enumerate N1..N7, any code up to 2 chars is accepted", () => {
    expect(ngoaiNgu.validateRelated(s("8"), { ma_ngoai_ngu: "N9" })).toEqual([]);
  });

  it("is a Subject: the base-class behaviour is inherited", () => {
    expect(ngoaiNgu).toBeInstanceOf(Subject);
    expect(ngoaiNgu.parseScore("8.255")).toEqual({ ok: false, reason: "TOO_MANY_DECIMALS" });
  });
});
