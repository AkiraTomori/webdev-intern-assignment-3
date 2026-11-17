import { describe, expect, it } from "vitest";
import { subjects, GROUP_A } from "../../domain";
import { Subject } from "../../domain/subject";
import { SubjectRegistry } from "../../domain/subject-registry";
import { SubjectGroup } from "../../domain/subject-group";
import { s } from "./helpers";

describe("SubjectRegistry", () => {
  it("codes() are exactly the 9 subjects in CSV and API order", () => {
    expect(subjects.codes()).toEqual([
      "toan", "ngu_van", "ngoai_ngu", "vat_li", "hoa_hoc", "sinh_hoc", "lich_su", "dia_li", "gdcd",
    ]);
    expect(subjects.all().map((x) => x.code)).toEqual(subjects.codes());
  });

  it("ngoai_ngu is the one subject with related-column rules", () => {
    expect(subjects.get("ngoai_ngu").validateRelated(s("8"), {})).toEqual(["SCORE_WITHOUT_EXAM_CODE"]);
    expect(subjects.get("toan").validateRelated(s("8"), {})).toEqual([]);
  });

  it("building a registry with two subjects of the same code throws", () => {
    expect(() => new SubjectRegistry([new Subject("toan", "A"), new Subject("toan", "B")])).toThrow(/duplicate/i);
  });

  it.each(["Toan", "to an", "toan1", "", "toan; DROP TABLE"])("rejects a code that is not ^[a-z_]+$: %j", (code) => {
    expect(() => new SubjectRegistry([new Subject(code, "X")])).toThrow(/invalid/i);
  });

  it("rejects an empty registry", () => {
    expect(() => new SubjectRegistry([])).toThrow();
  });

  it.each(["toan; DROP TABLE", "TOAN", "", "constructor", "__proto__", "toString"])(
    "has(%j) is false, so it can never become a SQL column name",
    (code) => {
      expect(subjects.has(code)).toBe(false);
    },
  );

  it("has() is true for every registered code", () => {
    for (const code of subjects.codes()) expect(subjects.has(code)).toBe(true);
  });

  it("get() of an unknown code is a programmer error and throws", () => {
    expect(() => subjects.get("toan_hoc" as never)).toThrow(/unknown subject/i);
  });

  it("all() and codes() cannot be used to mutate the registry", () => {
    const before = subjects.codes().length;
    try {
      (subjects.codes() as string[]).push("x");
    } catch {
      /* frozen: throwing is fine too */
    }
    expect(subjects.codes()).toHaveLength(before);
  });
});

describe("SubjectGroup / GROUP_A", () => {
  it("GROUP_A is built from the registry, its codes are toan, vat_li, hoa_hoc", () => {
    expect(GROUP_A.codes()).toEqual(["toan", "vat_li", "hoa_hoc"]);
    expect(GROUP_A.subjects[0]).toBe(subjects.get("toan"));
  });

  it("a group built from an unknown code throws instead of silently shrinking", () => {
    expect(() => SubjectGroup.fromCodes("X", subjects, ["toan", "toan_hoc"])).toThrow(/unknown subject/i);
  });

  it("rejects an empty group and a repeated subject", () => {
    expect(() => SubjectGroup.fromCodes("X", subjects, [])).toThrow();
    expect(() => SubjectGroup.fromCodes("X", subjects, ["toan", "toan"])).toThrow(/duplicate/i);
  });

  it("the total of 9.1 + 9.2 + 9.3 is exactly 27.6", () => {
    const total = GROUP_A.totalOf({ toan: s("9.1"), vat_li: s("9.2"), hoa_hoc: s("9.3") });
    expect(total?.toString()).toBe("27.6");
    expect(total?.toNumber()).toBe(27.6);
  });

  it("the total of 9.6 + 9.5 + 9.5 is exactly 28.6", () => {
    const total = GROUP_A.totalOf({ toan: s("9.6"), vat_li: s("9.5"), hoa_hoc: s("9.5") });
    expect(total?.toString()).toBe("28.6");
    expect(total?.toNumber()).toBe(28.6);
  });

  it.each([
    ["hoa_hoc is null", { toan: s("9.9"), vat_li: s("9.9"), hoa_hoc: null }],
    ["hoa_hoc is missing", { toan: s("9.9"), vat_li: s("9.9") }],
  ])("incomplete when %s, so no total", (_label, scores) => {
    expect(GROUP_A.isComplete(scores)).toBe(false);
    expect(GROUP_A.totalOf(scores)).toBeNull();
  });

  it("a real 0 counts as present", () => {
    const scores = { toan: s("9.9"), vat_li: s("9.9"), hoa_hoc: s("0") };
    expect(GROUP_A.isComplete(scores)).toBe(true);
    expect(GROUP_A.totalOf(scores)?.toString()).toBe("19.8");
  });

  it("scores of subjects outside the group are ignored", () => {
    const scores = { toan: s("1"), vat_li: s("2"), hoa_hoc: s("3"), sinh_hoc: s("10") };
    expect(GROUP_A.totalOf(scores)?.toString()).toBe("6");
  });
});
