import { describe, expect, it } from "vitest";
import { formatScore } from "../lib/format-score";

describe("formatScore (F0-AC09, GS-09-AC03)", () => {
  it("uses a decimal point", () => {
    expect(formatScore(8.4)).toBe("8.4");
    expect(formatScore(28.6)).toBe("28.6");
    expect(formatScore(6.75)).toBe("6.75");
  });

  it("does not pad whole numbers with zeros", () => {
    expect(formatScore(8)).toBe("8");
    expect(formatScore(0)).toBe("0");
  });

  it("keeps at most 2 decimals and cleans float noise", () => {
    expect(formatScore(0.1 + 0.2)).toBe("0.3");
    expect(formatScore(27.250000000000004)).toBe("27.25");
  });

  it("rejects values that are not finite numbers", () => {
    expect(() => formatScore(Number.NaN)).toThrow(RangeError);
    expect(() => formatScore(Infinity)).toThrow(RangeError);
  });
});
