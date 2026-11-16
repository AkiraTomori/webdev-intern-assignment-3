import { z } from "zod";
import { GROUP_A, ScoreLevel, subjects, type ScoreLevelKey, type SubjectCode } from "../domain";

/** Default and bounds of `?limit=` for the top list (api.md §5, GS-04-AC07). Declared once. */
export const DEFAULT_TOP_LIMIT = 10;
export const MIN_TOP_LIMIT = 1;
export const MAX_TOP_LIMIT = 20;

/**
 * Digits only (one or two), so "1.5", "1e1", " 5", "-1" and "" fail before Number() runs.
 * A repeated key (`?limit=1&limit=2`) arrives as an array and fails `z.string()`.
 * Unknown keys are ignored (z.object is not strict).
 */
export const topGroupAQuerySchema = z.object({
  limit: z
    .string()
    .regex(/^\d{1,2}$/)
    .transform(Number)
    .pipe(z.number().int().min(MIN_TOP_LIMIT).max(MAX_TOP_LIMIT))
    .optional(),
});

// Keys come from the domain (ScoreLevel.all, registry, GROUP_A), never typed by hand (GS-05-AC01, AC03).
const countsShape = Object.fromEntries(
  ScoreLevel.all.map((level) => [level.key, z.number().int().min(0)]),
) as Record<ScoreLevelKey, z.ZodNumber>;

export const scoreLevelsDataSchema = z.object({
  levels: z.array(z.object({ key: z.enum(ScoreLevel.all.map((level) => level.key) as [ScoreLevelKey, ...ScoreLevelKey[]]), label: z.string() }).strict()),
  subjects: z.array(
    z
      .object({
        code: z.enum(subjects.codes() as [SubjectCode, ...SubjectCode[]]),
        name: z.string(),
        total: z.number().int().min(0),
        counts: z.object(countsShape).strict(),
      })
      .strict(),
  ),
});
export const scoreLevelsResponseSchema = z.object({ data: scoreLevelsDataSchema }).strict();
export type ScoreLevelsDto = z.infer<typeof scoreLevelsDataSchema>;

const groupScoreShape = Object.fromEntries(GROUP_A.codes().map((code) => [code, z.number().min(0)])) as Record<
  SubjectCode,
  z.ZodNumber
>;

export const topGroupARowSchema = z
  .object({ rank: z.number().int().min(1), sbd: z.string().regex(/^\d{8}$/), ...groupScoreShape, total: z.number().min(0) })
  .strict();
export const topGroupAResponseSchema = z.object({ data: z.array(topGroupARowSchema) }).strict();
export type TopGroupARowDto = z.infer<typeof topGroupARowSchema>;
