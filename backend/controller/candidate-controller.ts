import type { RequestHandler } from "express";
import { subjects, type SubjectCode } from "../domain";
import type { CandidateRecord } from "../model/candidate-model";
import type { CandidateDto } from "../schema/candidate";
import { candidateParamsSchema } from "../schema/candidate";
import type { CandidateService } from "../service/candidate-service";

/** Builds the response by walking the registry in order: no subject key is typed here. */
export function toCandidateDto(record: CandidateRecord): CandidateDto {
  const scores = {} as Record<SubjectCode, number | null>;
  for (const code of subjects.codes()) scores[code] = record.scores[code]?.toNumber() ?? null;
  return { sbd: record.sbd, scores, foreignLanguageCode: record.maNgoaiNgu };
}

export function lookupCandidate(service: CandidateService): RequestHandler {
  return async (req, res) => {
    const { sbd } = candidateParamsSchema.parse(req.params); // already validated by middleware
    res.json({ data: toCandidateDto(await service.lookup(sbd)) });
  };
}
