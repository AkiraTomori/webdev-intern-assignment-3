import { Prisma } from "../generated/prisma/client";
import type { PrismaClient } from "../generated/prisma/client";
import { subjects, type Score, type SubjectCode } from "../domain";

/** A validated candidate ready to store. `null` score = did not sit the subject (never 0). */
export interface NewCandidate {
  readonly sbd: string;
  readonly scores: Readonly<Record<SubjectCode, Score | null>>;
  readonly maNgoaiNgu: string | null;
}

// Column identifiers come only from the subject registry (CODE_PATTERN-checked) plus two fixed names.
// Values are always bind parameters; nothing from the CSV reaches SQL as an identifier.
const COLUMNS = ["sbd", ...subjects.codes(), "ma_ngoai_ngu"] as const;
export const CANDIDATE_COLUMN_COUNT = COLUMNS.length;
/** PostgreSQL allows 65,535 bind parameters per statement. */
export const MAX_BATCH_SIZE = Math.floor(65535 / CANDIDATE_COLUMN_COUNT);

export async function countCandidates(prisma: PrismaClient): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM "candidates"`;
  return Number(rows[0]?.n ?? 0);
}

export async function truncateCandidates(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRaw`TRUNCATE TABLE "candidates"`;
}

/** One INSERT statement (one implicit transaction) for the whole batch. Returns the rows inserted. */
export async function insertCandidateBatch(prisma: PrismaClient, rows: readonly NewCandidate[]): Promise<number> {
  if (rows.length === 0) return 0;
  const columns = Prisma.join(COLUMNS.map((name) => Prisma.raw(`"${name}"`)));
  const tuples = rows.map((row) => {
    const values = [
      row.sbd,
      ...subjects.codes().map((code) => row.scores[code]?.toString() ?? null),
      row.maNgoaiNgu,
    ];
    return Prisma.sql`(${Prisma.join(values)})`;
  });
  return prisma.$executeRaw`INSERT INTO "candidates" (${columns}) VALUES ${Prisma.join(tuples)}`;
}
