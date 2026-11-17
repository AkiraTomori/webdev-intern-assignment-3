import type { RequestHandler } from "express";
import { GROUP_A, ScoreLevel, subjects, type ScoreLevelKey } from "../domain";
import type { SubjectLevelCounts } from "../model/report-model";
import { DEFAULT_TOP_LIMIT, topGroupAQuerySchema, type ScoreLevelsDto, type TopGroupARowDto } from "../schema/report";
import type { ReportService, TopGroupAEntry } from "../service/report-service";

/** Walks ScoreLevel.all and the registry in order: no level or subject key is typed here. */
export function toScoreLevelsDto(result: readonly SubjectLevelCounts[]): ScoreLevelsDto {
  const byCode = new Map(result.map((item) => [item.code, item]));
  return {
    levels: ScoreLevel.all.map(({ key, label }) => ({ key, label })),
    subjects: subjects.all().map((subject) => {
      const item = byCode.get(subject.code);
      const counts = {} as Record<ScoreLevelKey, number>;
      for (const level of ScoreLevel.all) counts[level.key] = item?.counts[level.key] ?? 0;
      return { code: subject.code, name: subject.name, total: item?.total ?? 0, counts };
    }),
  };
}

export function toTopGroupADto(entries: readonly TopGroupAEntry[]): TopGroupARowDto[] {
  return entries.map((entry) => {
    const row: Record<string, string | number> = { rank: entry.rank, sbd: entry.sbd };
    for (const code of GROUP_A.codes()) row[code] = entry.scores[code].toNumber();
    row.total = entry.total.toNumber();
    return row as TopGroupARowDto;
  });
}

export function scoreLevels(service: ReportService): RequestHandler {
  return async (_req, res) => {
    res.json({ data: toScoreLevelsDto(await service.scoreLevels()) });
  };
}

export function topGroupA(service: ReportService): RequestHandler {
  return async (req, res) => {
    // Already validated by middleware; parse again for the transformed value (Express 5 req.query is read-only).
    const { limit } = topGroupAQuerySchema.parse(req.query);
    res.json({ data: toTopGroupADto(await service.topOfGroupA(limit ?? DEFAULT_TOP_LIMIT)) });
  };
}
