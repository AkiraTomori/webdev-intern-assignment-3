import { describe, expect, it } from "vitest";
import { ScoreLevel } from "../../domain/score-level";
import { s } from "./helpers";

describe("ScoreLevel", () => {
  it.each([
    ["10", "gte8"],
    ["8", "gte8"],
    ["7.99", "gte6"],
    ["6", "gte6"],
    ["5.99", "gte4"],
    ["4", "gte4"],
    ["3.99", "lt4"],
    ["0", "lt4"],
  ])("GS-03-AC01: score %s falls in level %s", (raw, key) => {
    expect(ScoreLevel.of(s(raw)).key).toBe(key);
  });

  it("GS-03-AC01: all() has 4 levels with key/label exactly as api.md §4, highest first", () => {
    expect(ScoreLevel.all.map((l) => ({ key: l.key, label: l.label }))).toEqual([
      { key: "gte8", label: "≥ 8" },
      { key: "gte6", label: "6 ≤ x < 8" },
      { key: "gte4", label: "4 ≤ x < 6" },
      { key: "lt4", label: "< 4" },
    ]);
  });

  it("GS-03-AC01: the 4 intervals are half-open, adjacent, non-overlapping and cover everything", () => {
    const levels = ScoreLevel.all;
    expect(levels[0]!.max).toBeNull();
    expect(levels[levels.length - 1]!.min).toBeNull();
    for (let i = 0; i < levels.length - 1; i++) {
      expect(levels[i]!.min!.compareTo(levels[i + 1]!.max!)).toBe(0);
    }
    // every score on the 0.01 grid from 0 to 10 lands in exactly one level
    for (let h = 0; h <= 1000; h++) {
      const score = s((h / 100).toFixed(2));
      expect(levels.filter((l) => l.contains(score))).toHaveLength(1);
    }
  });

  it("exposes min (inclusive) and max (exclusive) as Score so SQL thresholds are not rewritten elsewhere", () => {
    const gte6 = ScoreLevel.all[1]!;
    expect(gte6.min?.toString()).toBe("6");
    expect(gte6.max?.toString()).toBe("8");
  });
});
