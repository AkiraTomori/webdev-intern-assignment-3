import { describe, expect, it } from "vitest";
import { formatCount } from "../lib/format-count";

describe("formatCount", () => {
  it.each([
    [0, "0", "0"],
    [999, "999", "999"],
    [1000, "1.000", "1,000"],
    [1045613, "1.045.613", "1,045,613"],
  ])("%d is %s in vi and %s in en", (value, vi, en) => {
    expect(formatCount(value, "vi")).toBe(vi);
    expect(formatCount(value, "en")).toBe(en);
  });
});
