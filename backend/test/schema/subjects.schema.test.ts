import { afterAll, describe, expect, it } from "vitest";
import { subjects } from "../../domain";
import { createPrismaClient } from "../../model/client";
import { testDatabaseUrl } from "../helpers/test-database";

const prisma = createPrismaClient(testDatabaseUrl());

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GS-05-AC02 the subject registry and the candidates table agree", () => {
  it("GS-05-AC02: score columns of candidates (all but sbd and ma_ngoai_ngu) are exactly subjects.codes()", async () => {
    const rows = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'candidates'`;
    const scoreColumns = rows.map((r) => r.column_name).filter((name) => name !== "sbd" && name !== "ma_ngoai_ngu");
    expect(new Set(scoreColumns)).toEqual(new Set(subjects.codes()));
    expect(scoreColumns).toHaveLength(subjects.codes().length);
  });
});
