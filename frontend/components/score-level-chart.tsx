"use client";

import { useLocale, useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toChartRows, type ChartRow, type ScoreLevelsReport } from "@/lib/api/score-levels";
import { LEVEL_KEYS, type LevelKey, type SubjectCode } from "@/lib/api/vocabulary";
import { barsChartHeight, chartLayout } from "@/lib/chart-layout";
import { formatCount } from "@/lib/format-count";
import { useElementWidth } from "@/lib/use-element-width";
import styles from "./reports-view.module.css";

// Recharts paints light defaults (white tooltip, grey axes). Every colour below is a CSS variable,
// so a theme change recolours the SVG without redrawing it (design F1-F3 §4.2).
const AXIS = { stroke: "var(--chart-axis)", tick: { fill: "var(--chart-axis)" } };

export function ScoreLevelChart({ report }: { report: ScoreLevelsReport }) {
  const t = useTranslations();
  const locale = useLocale();
  const rows = toChartRows(report, (code: SubjectCode) => t(`subject.${code}`));
  const levelName = (key: LevelKey) => t(`level.${key}`);
  // The layout follows the width of the frame, not the screen: at tablet width the sidebar leaves it narrow.
  const [frameRef, frameWidth] = useElementWidth<HTMLDivElement>();
  const bars = chartLayout(frameWidth) === "bars";
  // Compact numbers only on the axis (1 Tr / 1M); tooltip and table keep the full count.
  const axisCount = (value: number) =>
    new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);

  return (
    <div ref={frameRef} className={styles.chartFrame} role="img" aria-label={t("reports.chartLabel")} tabIndex={0}>
      <div className={bars ? styles.chartBars : styles.chart} style={bars ? { height: barsChartHeight(rows.length) } : undefined}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout={bars ? "vertical" : "horizontal"}
            barCategoryGap={bars ? "20%" : "10%"}
            margin={{ top: 8, right: bars ? 20 : 8, bottom: 8, left: bars ? 0 : 8 }}
          >
            <CartesianGrid stroke="var(--chart-grid)" vertical={bars} horizontal={!bars} />
            {bars ? (
              <>
                <XAxis type="number" tickCount={4} tickFormatter={axisCount} {...AXIS} />
                <YAxis type="category" dataKey="name" width={108} interval={0} {...AXIS} />
              </>
            ) : (
              <>
                <XAxis dataKey="name" interval={0} {...AXIS} />
                <YAxis width={72} tickFormatter={(value: number) => formatCount(value, locale)} {...AXIS} />
              </>
            )}
            <Tooltip
              cursor={{ fill: "var(--border)", fillOpacity: 0.35 }}
              contentStyle={{ background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6 }}
              labelStyle={{ color: "var(--text)", fontWeight: 600 }}
              itemStyle={{ color: "var(--text)" }}
              itemSorter={(item) => LEVEL_KEYS.indexOf(item.dataKey as LevelKey)}
              labelFormatter={(label, payload) => {
                const row = payload?.[0]?.payload as ChartRow | undefined;
                return row ? `${label} · ${t("reports.tooltipTotal", { count: formatCount(row.total, locale) })}` : String(label);
              }}
              formatter={(value) => formatCount(Number(value), locale)}
            />
            <Legend itemSorter={null} verticalAlign={bars ? "top" : "bottom"} />
            {LEVEL_KEYS.map((key) => (
              <Bar key={key} dataKey={key} name={levelName(key)} fill={`var(--level-${key})`} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
