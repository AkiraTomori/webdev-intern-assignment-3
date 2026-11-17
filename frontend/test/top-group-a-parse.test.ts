import { describe, expect, it } from "vitest";
import { parseTopGroupAResponse } from "../lib/api/top-group-a";

const row = (rank: number, overrides: Record<string, unknown> = {}) => ({
  rank,
  sbd: `2602${String(rank).padStart(4, "0")}`,
  toan: 9.8,
  vat_li: 9.8,
  hoa_hoc: 10,
  total: 29.6,
  ...overrides,
});
const rows = (n: number) => Array.from({ length: n }, (_, index) => row(index + 1));

describe("parseTopGroupAResponse", () => {
  it("accepts 10 rows", () => {
    expect(parseTopGroupAResponse(rows(10))).toHaveLength(10);
  });

  it("accepts an empty array: nobody took all three subjects", () => {
    expect(parseTopGroupAResponse([])).toEqual([]);
  });

  it("keeps the API's order and a total such as 28.6 exactly", () => {
    const parsed = parseTopGroupAResponse([row(1, { total: 28.6 }), row(2, { total: 28.6 })]);
    expect(parsed?.map((r) => r.total)).toEqual([28.6, 28.6]);
    expect(parsed?.map((r) => r.sbd)).toEqual(["26020001", "26020002"]);
  });

  it("rejects 11 rows", () => {
    expect(parseTopGroupAResponse(rows(11))).toBeNull();
  });

  it("rejects a rank that skips", () => {
    expect(parseTopGroupAResponse([row(1), row(3)])).toBeNull();
  });

  it("rejects a missing subject", () => {
    const incomplete: Record<string, unknown> = { ...row(1) };
    delete incomplete.vat_li;
    expect(parseTopGroupAResponse([incomplete])).toBeNull();
  });

  it("rejects a total above 30 and an SBD that is not 8 digits", () => {
    expect(parseTopGroupAResponse([row(1, { total: 31 })])).toBeNull();
    expect(parseTopGroupAResponse([row(1, { sbd: "123" })])).toBeNull();
  });

  it("rejects something that is not an array", () => {
    expect(parseTopGroupAResponse({ data: [] })).toBeNull();
    expect(parseTopGroupAResponse(null)).toBeNull();
  });
});
