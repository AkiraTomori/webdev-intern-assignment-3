import { describe, expect, it } from "vitest";
import { parseCandidateResponse } from "../lib/api/candidate";

// A sample candidate: the first row of the CSV.
const valid = () => ({
  sbd: "01000001",
  scores: { toan: 8.4, ngu_van: 6.75, ngoai_ngu: 8.0, vat_li: 6.0, hoa_hoc: 5.25, sinh_hoc: 5.0, lich_su: null, dia_li: null, gdcd: null },
  foreignLanguageCode: "N1",
});

describe("parseCandidateResponse", () => {
  it("accepts a sample candidate and keeps null as null, not 0", () => {
    const candidate = parseCandidateResponse(valid());
    expect(candidate?.sbd).toBe("01000001");
    expect(candidate?.scores.toan).toBe(8.4);
    expect(candidate?.scores.lich_su).toBeNull();
    expect(candidate?.foreignLanguageCode).toBe("N1");
  });

  it("keeps the leading zero of the SBD", () => {
    expect(parseCandidateResponse(valid())?.sbd).toBe("01000001");
  });

  it("accepts a candidate with no foreign language: code null", () => {
    expect(parseCandidateResponse({ ...valid(), foreignLanguageCode: null })).not.toBeNull();
  });

  it("rejects a missing subject", () => {
    const scores: Record<string, unknown> = { ...valid().scores };
    delete scores.toan;
    expect(parseCandidateResponse({ ...valid(), scores })).toBeNull();
  });

  it("rejects an extra subject", () => {
    expect(parseCandidateResponse({ ...valid(), scores: { ...valid().scores, tin_hoc: 5 } })).toBeNull();
  });

  it("rejects a score that is a string", () => {
    expect(parseCandidateResponse({ ...valid(), scores: { ...valid().scores, toan: "8.4" } })).toBeNull();
  });

  it("rejects an SBD that is a number (it would lose the leading zero)", () => {
    expect(parseCandidateResponse({ ...valid(), sbd: 1000001 })).toBeNull();
  });

  it("rejects an SBD that is not 8 digits", () => {
    expect(parseCandidateResponse({ ...valid(), sbd: "1000001" })).toBeNull();
  });

  it("rejects a score outside 0 to 10", () => {
    expect(parseCandidateResponse({ ...valid(), scores: { ...valid().scores, toan: 11 } })).toBeNull();
    expect(parseCandidateResponse({ ...valid(), scores: { ...valid().scores, toan: -1 } })).toBeNull();
  });

  it("rejects an empty foreign language code", () => {
    expect(parseCandidateResponse({ ...valid(), foreignLanguageCode: "" })).toBeNull();
  });

  it("rejects things that are not objects", () => {
    for (const value of [null, undefined, "x", 1, []]) expect(parseCandidateResponse(value)).toBeNull();
  });
});
