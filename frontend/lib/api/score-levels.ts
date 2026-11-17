import { getJson } from "./client";
import { hasExactKeys, isCount, isRecord } from "./guards";
import { LEVEL_KEYS, SUBJECT_CODES, type LevelKey, type SubjectCode } from "./vocabulary";

export type SubjectLevelCounts = { code: SubjectCode; total: number; counts: Record<LevelKey, number> };
/** Subjects in SUBJECT_CODES order, whatever order the API used. */
export type ScoreLevelsReport = { subjects: SubjectLevelCounts[] };

/** Accepts api.md §4. The four counts of each subject must add up to its total (GS-03-AC02). */
export function parseScoreLevelsResponse(data: unknown): ScoreLevelsReport | null {
  if (!isRecord(data) || !Array.isArray(data.levels) || !Array.isArray(data.subjects)) return null;

  const levelKeys = data.levels.map((level) => (isRecord(level) ? level.key : undefined));
  if (levelKeys.length !== LEVEL_KEYS.length || !LEVEL_KEYS.every((key) => levelKeys.includes(key))) return null;
  if (data.subjects.length !== SUBJECT_CODES.length) return null;

  const byCode = new Map<SubjectCode, SubjectLevelCounts>();
  for (const item of data.subjects) {
    if (!isRecord(item) || !isRecord(item.counts)) return null;
    const code = item.code as SubjectCode;
    if (!SUBJECT_CODES.includes(code) || byCode.has(code)) return null;
    if (!isCount(item.total) || !hasExactKeys(item.counts, LEVEL_KEYS)) return null;

    const counts = {} as Record<LevelKey, number>;
    let sum = 0;
    for (const key of LEVEL_KEYS) {
      const value = item.counts[key];
      if (!isCount(value)) return null;
      counts[key] = value;
      sum += value;
    }
    if (sum !== item.total) return null;
    byCode.set(code, { code, total: item.total, counts });
  }

  return { subjects: SUBJECT_CODES.map((code) => byCode.get(code)!) };
}

export function getScoreLevels(signal?: AbortSignal) {
  return getJson("/api/reports/score-levels", parseScoreLevelsResponse, signal);
}

export type ChartRow = { code: SubjectCode; name: string; total: number } & Record<LevelKey, number>;

/** One row per subject for the chart, in SUBJECT_CODES order. `subjectLabel` is the translation function. */
export function toChartRows(report: ScoreLevelsReport, subjectLabel: (code: SubjectCode) => string): ChartRow[] {
  return report.subjects.map(({ code, total, counts }) => ({ code, name: subjectLabel(code), total, ...counts }));
}

/** B3 answers 200 with zeros when the table is not seeded (design B3+B4), so "empty" means all totals are 0. */
export function isEmptyReport(report: ScoreLevelsReport): boolean {
  return report.subjects.every((subject) => subject.total === 0);
}
