/** Below this frame width (CSS px) the chart draws horizontal bars instead of columns. */
export const CHART_BARS_BELOW = 560;

export type ChartLayout = "columns" | "bars";

/** Pure. `undefined` means the frame has not been measured yet: draw columns (the desktop default). */
export function chartLayout(width: number | undefined): ChartLayout {
  return width !== undefined && width < CHART_BARS_BELOW ? "bars" : "columns";
}

/** Height of the horizontal-bar chart: 4 bars per subject, plus room for the legend and the axis. */
export const BARS_ROW_HEIGHT = 64;
export const BARS_EXTRA_HEIGHT = 80;

export function barsChartHeight(subjectCount: number): number {
  return subjectCount * BARS_ROW_HEIGHT + BARS_EXTRA_HEIGHT;
}
