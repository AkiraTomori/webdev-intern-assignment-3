import { getJson } from "./client";
import { hasExactKeys, isRecord, isSbd, isScore } from "./guards";
import { SUBJECT_CODES, type SubjectCode } from "./vocabulary";

export type Candidate = {
  sbd: string;
  scores: Record<SubjectCode, number | null>;
  foreignLanguageCode: string | null;
};

/** Accepts the api.md §3 shape and nothing else. Returns null for anything that is not safe to draw. */
export function parseCandidateResponse(data: unknown): Candidate | null {
  if (!isRecord(data) || !isSbd(data.sbd) || !isRecord(data.scores)) return null;
  if (!hasExactKeys(data.scores, SUBJECT_CODES)) return null;

  const scores = {} as Record<SubjectCode, number | null>;
  for (const code of SUBJECT_CODES) {
    const value = data.scores[code];
    if (value !== null && !isScore(value)) return null;
    scores[code] = value as number | null;
  }

  const code = data.foreignLanguageCode;
  if (code !== null && (typeof code !== "string" || code === "")) return null;
  return { sbd: data.sbd, scores, foreignLanguageCode: code };
}

export function getCandidate(sbd: string, signal?: AbortSignal) {
  return getJson(`/api/candidates/${encodeURIComponent(sbd)}`, parseCandidateResponse, signal);
}
