import { GROUP_A } from "../domain";
import type { PrismaClient } from "../generated/prisma/client";
import { countScoreLevels, findTopOfGroup, type RankedCandidate, type SubjectLevelCounts } from "../model/report-model";

export type TopGroupAEntry = RankedCandidate<(typeof GROUP_A)["subjects"][number]["code"]> & { readonly rank: number };

export class ReportService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Counts per subject and level. A broken invariant is a code bug (500), not a client error. */
  async scoreLevels(): Promise<readonly SubjectLevelCounts[]> {
    const result = await countScoreLevels(this.prisma);
    for (const subject of result) {
      const sum = Object.values(subject.counts).reduce((a, b) => a + b, 0);
      if (sum !== subject.total) {
        throw new Error(`Level counts for ${subject.code} sum to ${sum}, expected ${subject.total}`);
      }
    }
    return result;
  }

  /** Top of group A. Rank is the position (1…N): equal totals still get different ranks. */
  async topOfGroupA(limit: number): Promise<readonly TopGroupAEntry[]> {
    const rows = await findTopOfGroup(this.prisma, GROUP_A, limit);
    return rows.map((row, index) => {
      // The SQL sum must equal the OOP definition of the group total (exact, in hundredths).
      const expected = GROUP_A.totalOf(row.scores);
      if (expected === null || expected.compareTo(row.total) !== 0) {
        throw new Error(`SQL group total ${row.total.toString()} differs from domain total for rank ${index + 1}`);
      }
      return { rank: index + 1, ...row };
    });
  }
}
