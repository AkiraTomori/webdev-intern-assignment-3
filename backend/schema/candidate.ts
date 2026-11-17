import { z } from "zod";
import { subjects, type SubjectCode } from "../domain";
import { sbdSchema } from "./sbd";

export const candidateParamsSchema = z.object({ sbd: sbdSchema });

// Score keys come from the registry, never typed by hand.
const scoreShape = Object.fromEntries(
  subjects.codes().map((code) => [code, z.number().min(0).nullable()]),
) as Record<SubjectCode, z.ZodNullable<z.ZodNumber>>;

/** Shape of the 200 body's `data`. */
export const candidateDataSchema = z.object({
  sbd: sbdSchema,
  scores: z.object(scoreShape).strict(),
  foreignLanguageCode: z.string().nullable(),
});
export const candidateResponseSchema = z.object({ data: candidateDataSchema });

export type CandidateDto = z.infer<typeof candidateDataSchema>;
