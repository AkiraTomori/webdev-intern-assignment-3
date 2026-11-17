import { describe, expect, it } from "vitest";
import { barsChartHeight, CHART_BARS_BELOW, chartLayout } from "../lib/chart-layout";

describe("chartLayout", () => {
  it.each([
    [undefined, "columns"],
    [CHART_BARS_BELOW - 1, "bars"],
    [CHART_BARS_BELOW, "columns"],
    [1000, "columns"],
    [0, "bars"],
  ])("width %s draws %s", (width, expected) => {
    expect(chartLayout(width)).toBe(expected);
  });

  it("threshold is 560", () => {
    expect(CHART_BARS_BELOW).toBe(560);
  });

  it("bars height grows with the number of subjects", () => {
    expect(barsChartHeight(9)).toBe(9 * 64 + 80);
  });
});
