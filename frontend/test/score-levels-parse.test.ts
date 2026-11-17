import { describe, expect, it } from "vitest";
import { isEmptyReport, parseScoreLevelsResponse, toChartRows } from "../lib/api/score-levels";
import { LEVEL_KEYS, SUBJECT_CODES } from "../lib/api/vocabulary";

const levels = LEVEL_KEYS.map((key) => ({ key, label: key }));
const subject = (code: string, counts = { gte8: 1, gte6: 2, gte4: 3, lt4: 4 }) => ({
  code,
  name: code,
  total: Object.values(counts).reduce((a, b) => a + b, 0),
  counts,
});
const valid = () => ({ levels, subjects: SUBJECT_CODES.map((code) => subject(code)) });

describe("parseScoreLevelsResponse (GS-03-AC02, AC05)", () => {
  it("accepts nine subjects with four counts each", () => {
    const report = parseScoreLevelsResponse(valid());
    expect(report?.subjects).toHaveLength(9);
    expect(report?.subjects[0]).toEqual({ code: "toan", total: 10, counts: { gte8: 1, gte6: 2, gte4: 3, lt4: 4 } });
  });

  it("accepts the empty table: every count 0 is still a valid report", () => {
    const empty = { levels, subjects: SUBJECT_CODES.map((code) => subject(code, { gte8: 0, gte6: 0, gte4: 0, lt4: 0 })) };
    const report = parseScoreLevelsResponse(empty);
    expect(report).not.toBeNull();
    expect(isEmptyReport(report!)).toBe(true);
  });

  it("is not empty when at least one subject has candidates", () => {
    expect(isEmptyReport(parseScoreLevelsResponse(valid())!)).toBe(false);
  });

  it("puts subjects in SUBJECT_CODES order even if the API order differs", () => {
    const reversed = { ...valid(), subjects: [...valid().subjects].reverse() };
    expect(parseScoreLevelsResponse(reversed)?.subjects.map((s) => s.code)).toEqual([...SUBJECT_CODES]);
  });

  it("rejects counts that do not add up to the total", () => {
    const data = valid();
    data.subjects[0]!.total += 1;
    expect(parseScoreLevelsResponse(data)).toBeNull();
  });

  it("rejects a missing level", () => {
    const data = valid();
    const counts: Record<string, number> = { ...data.subjects[0]!.counts };
    delete counts.lt4;
    data.subjects[0]!.counts = counts as never;
    expect(parseScoreLevelsResponse(data)).toBeNull();
  });

  it("rejects a missing level in the levels list", () => {
    expect(parseScoreLevelsResponse({ ...valid(), levels: levels.slice(1) })).toBeNull();
  });

  it("rejects a missing, duplicated or unknown subject", () => {
    expect(parseScoreLevelsResponse({ ...valid(), subjects: valid().subjects.slice(1) })).toBeNull();
    const dup = valid();
    dup.subjects[1] = dup.subjects[0]!;
    expect(parseScoreLevelsResponse(dup)).toBeNull();
    const unknown = valid();
    unknown.subjects[0] = subject("tin_hoc");
    expect(parseScoreLevelsResponse(unknown)).toBeNull();
  });

  it("rejects negative and fractional counts", () => {
    const negative = valid();
    negative.subjects[0]!.counts.gte8 = -1;
    negative.subjects[0]!.total = 8;
    expect(parseScoreLevelsResponse(negative)).toBeNull();
    const fractional = valid();
    fractional.subjects[0]!.counts.gte8 = 1.5;
    fractional.subjects[0]!.total = 10.5;
    expect(parseScoreLevelsResponse(fractional)).toBeNull();
  });
});

describe("toChartRows (GS-03-AC03)", () => {
  it("makes one row per subject in SUBJECT_CODES order, numbers unchanged, names from the label function", () => {
    const rows = toChartRows(parseScoreLevelsResponse(valid())!, (code) => `label:${code}`);
    expect(rows.map((row) => row.code)).toEqual([...SUBJECT_CODES]);
    expect(rows[0]).toEqual({ code: "toan", name: "label:toan", total: 10, gte8: 1, gte6: 2, gte4: 3, lt4: 4 });
  });
});
