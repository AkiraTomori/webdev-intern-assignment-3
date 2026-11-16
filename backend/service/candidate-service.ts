import type { PrismaClient } from "../generated/prisma/client";
import { findCandidateBySbd, type CandidateRecord } from "../model/candidate-model";
import { AppError } from "../util/app-error";

export class CandidateService {
  constructor(private readonly prisma: PrismaClient) {}

  /** A valid but unknown SBD is a 404, never an empty 200. */
  async lookup(sbd: string): Promise<CandidateRecord> {
    const candidate = await findCandidateBySbd(this.prisma, sbd);
    if (!candidate) throw new AppError(404, "CANDIDATE_NOT_FOUND", "No candidate with this SBD");
    return candidate;
  }
}
