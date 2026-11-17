import { execFileSync } from "node:child_process";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "../../model/client";
import { assertTestDatabaseUrl, testDatabaseUrl } from "../helpers/test-database";

const url = testDatabaseUrl();
const prisma = createPrismaClient(url);

beforeEach(async () => {
  await prisma.candidate.deleteMany(); // test database only (guarded by testDatabaseUrl)
});
afterAll(async () => {
  await prisma.$disconnect();
});

const SBD = "01000001";

describe("schema from migrations", () => {
  it("table candidates has exactly the 11 columns of the candidates table", async () => {
    const rows = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'candidates' ORDER BY column_name`;
    expect(rows.map((r) => r.column_name)).toEqual(
      ["dia_li", "gdcd", "hoa_hoc", "lich_su", "ma_ngoai_ngu", "ngoai_ngu", "ngu_van", "sbd", "sinh_hoc", "toan", "vat_li"],
    );
  });

  it("running migrate deploy again is a no-op", () => {
    const out = execFileSync("npx", ["prisma", "migrate", "deploy"], {
      cwd: new URL("../..", import.meta.url),
      env: { ...process.env, DATABASE_URL: url },
    }).toString();
    expect(out).toContain("No pending migrations");
  });
});

describe("SBD is a string that keeps leading zeros", () => {
  it("01000001 round-trips as the string '01000001'", async () => {
    await prisma.candidate.create({ data: { sbd: SBD } });
    const row = await prisma.candidate.findUnique({ where: { sbd: "01000001" } });
    expect(row?.sbd).toBe("01000001");
    expect(await prisma.candidate.findUnique({ where: { sbd: "1000001" } })).toBeNull();
  });

  it.each([
    ["7 digits", "1000001"],
    ["9 digits", "010000012"],
    ["non-digit character", "0100000a"],
    ["empty", ""],
  ])("rejects SBD with %s", async (_label, sbd) => {
    await expect(prisma.candidate.create({ data: { sbd } })).rejects.toThrow();
  });

  it("rejects a duplicate SBD", async () => {
    await prisma.candidate.create({ data: { sbd: SBD } });
    await expect(prisma.candidate.create({ data: { sbd: SBD } })).rejects.toThrow();
  });
});

describe("a blank score is NULL, never 0", () => {
  it("subjects that were not entered read back as null", async () => {
    await prisma.candidate.create({ data: { sbd: SBD, toan: "8.4" } });
    const row = await prisma.candidate.findUniqueOrThrow({ where: { sbd: SBD } });
    expect(row.toan?.toString()).toBe("8.4");
    for (const key of ["ngu_van", "ngoai_ngu", "vat_li", "hoa_hoc", "sinh_hoc", "lich_su", "dia_li", "gdcd"] as const) {
      expect(row[key]).toBeNull();
    }
  });

  it("a real 0 score is stored as 0 and is distinct from NULL", async () => {
    await prisma.candidate.create({ data: { sbd: "00000001", dia_li: "0" } }); // CSV has 59 genuine zeros in dia_li
    await prisma.candidate.create({ data: { sbd: "00000002" } });
    const zero = await prisma.candidate.findUniqueOrThrow({ where: { sbd: "00000001" } });
    const blank = await prisma.candidate.findUniqueOrThrow({ where: { sbd: "00000002" } });
    expect(zero.dia_li).not.toBeNull();
    expect(zero.dia_li?.isZero()).toBe(true);
    expect(blank.dia_li).toBeNull();
    expect(await prisma.candidate.count({ where: { dia_li: { not: null } } })).toBe(1);
  });
});

describe("score precision and range", () => {
  it("keeps two decimals exactly (8.25)", async () => {
    await prisma.candidate.create({ data: { sbd: SBD, toan: "8.25" } });
    const row = await prisma.candidate.findUniqueOrThrow({ where: { sbd: SBD } });
    expect(row.toan?.toString()).toBe("8.25");
  });

  it("accepts the upper bound 10.00", async () => {
    await prisma.candidate.create({ data: { sbd: SBD, toan: "10.00" } });
    expect((await prisma.candidate.findUniqueOrThrow({ where: { sbd: SBD } })).toan?.toString()).toBe("10");
  });

  it.each([["10.01"], ["-0.01"]])("rejects out-of-range score %s", async (score) => {
    await expect(prisma.candidate.create({ data: { sbd: SBD, toan: score } })).rejects.toThrow();
  });

  it.each(["toan", "ngu_van", "ngoai_ngu", "vat_li", "hoa_hoc", "sinh_hoc", "lich_su", "dia_li", "gdcd"] as const)(
    "rejects 10.01 in column %s",
    async (column) => {
      await expect(
        prisma.candidate.create({ data: { sbd: SBD, [column]: "10.01", ...(column === "ngoai_ngu" ? { ma_ngoai_ngu: "N1" } : {}) } }),
      ).rejects.toThrow();
    },
  );
});

describe("ma_ngoai_ngu exists if and only if ngoai_ngu exists", () => {
  it("accepts a score with its code", async () => {
    await prisma.candidate.create({ data: { sbd: SBD, ngoai_ngu: "8.0", ma_ngoai_ngu: "N1" } });
    const row = await prisma.candidate.findUniqueOrThrow({ where: { sbd: SBD } });
    expect(row.ma_ngoai_ngu).toBe("N1");
  });

  it("accepts neither", async () => {
    await prisma.candidate.create({ data: { sbd: SBD, toan: "5" } });
  });

  it("rejects a code without a score", async () => {
    await expect(prisma.candidate.create({ data: { sbd: SBD, ma_ngoai_ngu: "N1" } })).rejects.toThrow();
  });

  it("rejects a score without a code", async () => {
    await expect(prisma.candidate.create({ data: { sbd: SBD, ngoai_ngu: "8.0" } })).rejects.toThrow();
  });
});

describe("test-database safety guard", () => {
  it("refuses a database whose name does not end with _test", () => {
    expect(() => assertTestDatabaseUrl("postgresql://postgres@127.0.0.1:5433/g_scores")).toThrow(/_test/);
    expect(() => assertTestDatabaseUrl(undefined)).toThrow(/DATABASE_URL_TEST/);
    expect(assertTestDatabaseUrl("postgresql://postgres@127.0.0.1:5433/g_scores_test")).toContain("g_scores_test");
  });
});
