import { Prisma } from "../generated/prisma/client";
import type { PrismaClient } from "../generated/prisma/client";
import { Score, ScoreLevel, subjects, type ScoreLevelKey, type SubjectCode, type SubjectGroup } from "../domain";

// Raw SQL lives here only (codebase.md). Column identifiers come from the registry (CODE_PATTERN-checked,
// DB1 §3.2); thresholds and `limit` are bind parameters. Nothing from the request becomes an identifier.

const ident = (code: string): Prisma.Sql => Prisma.raw(`"${code}"`);

export interface SubjectLevelCounts {
  readonly code: SubjectCode;
  readonly total: number;
  readonly counts: Readonly<Record<ScoreLevelKey, number>>;
}

/** WHERE clause for one level, from its half-open interval [min, max). An unbounded side is left out. */
function levelCondition(column: Prisma.Sql, level: ScoreLevel): Prisma.Sql {
  const parts: Prisma.Sql[] = [];
  if (level.min !== null) parts.push(Prisma.sql`${column} >= ${level.min.toString()}::numeric`);
  if (level.max !== null) parts.push(Prisma.sql`${column} < ${level.max.toString()}::numeric`);
  // Fully unbounded cannot happen (ScoreLevel asserts it), but NULL must still never be counted.
  return parts.length > 0 ? Prisma.join(parts, " AND ") : Prisma.sql`${column} IS NOT NULL`;
}

/**
 * One scan of the table, one row back: per subject, `total` (non-NULL scores) and one count per level.
 * NULL (did not sit the subject) matches no condition and is skipped by count(col): it is never a 0 (GS-03-AC02).
 * Every level, including lt4, is counted for real so the Σ = total invariant can be checked independently.
 */
export async function countScoreLevels(prisma: PrismaClient): Promise<readonly SubjectLevelCounts[]> {
  const selects: Prisma.Sql[] = [];
  for (const code of subjects.codes()) {
    const column = ident(code);
    selects.push(Prisma.sql`count(${column}) AS ${ident(`${code}__total`)}`);
    for (const level of ScoreLevel.all) {
      selects.push(
        Prisma.sql`count(*) FILTER (WHERE ${levelCondition(column, level)}) AS ${ident(`${code}__${level.key}`)}`,
      );
    }
  }
  const rows = await prisma.$queryRaw<Record<string, bigint | number>[]>`SELECT ${Prisma.join(selects)} FROM "candidates"`;
  const row = rows[0];
  if (!row) throw new Error("Score level query returned no row"); // an aggregate without GROUP BY always returns one
  // count(*) arrives as bigint; at most ~1.06 million, so Number() is exact.
  const read = (key: string): number => Number(row[key] ?? 0);
  return subjects.codes().map((code) => {
    const counts = {} as Record<ScoreLevelKey, number>;
    for (const level of ScoreLevel.all) counts[level.key] = read(`${code}__${level.key}`);
    return { code, total: read(`${code}__total`), counts };
  });
}

export interface RankedCandidate<C extends string> {
  readonly sbd: string;
  readonly scores: Readonly<Record<C, Score>>;
  readonly total: Score;
}

/**
 * Candidates who sat every subject of `group` (a real 0 counts, NULL does not), highest exact total first,
 * ties by SBD ascending (string compare, Q-02 a). `(total, sbd)` is unique because sbd is the primary key.
 * Sorting happens in PostgreSQL: pulling the rows into JS would break P5.
 */
export async function findTopOfGroup<C extends SubjectCode>(
  prisma: PrismaClient,
  group: SubjectGroup<C>,
  limit: number,
): Promise<readonly RankedCandidate<C>[]> {
  const codes = group.codes();
  const columns = codes.map(ident);
  const present = Prisma.join(columns.map((column) => Prisma.sql`${column} IS NOT NULL`), " AND ");
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT "sbd", ${Prisma.join(columns)}, (${Prisma.join(columns, " + ")}) AS "total"
    FROM "candidates"
    WHERE ${present}
    ORDER BY "total" DESC, "sbd" ASC
    LIMIT ${limit}`;
  // NUMERIC may come back as Prisma.Decimal or a string depending on the driver; String() handles both.
  const toScore = (value: unknown, what: string): Score => {
    const parsed = Score.parse(String(value));
    // DB1's CHECK constraints make this unreachable; if it happens it is corrupt data, not a client error.
    if (!parsed.ok) throw new Error(`Stored ${what} is not a valid score (${parsed.reason})`);
    return parsed.score;
  };
  return rows.map((row) => {
    const scores = {} as Record<C, Score>;
    for (const code of codes) scores[code] = toScore(row[code], code);
    return { sbd: String(row.sbd), scores, total: toScore(row.total, "group total") };
  });
}
