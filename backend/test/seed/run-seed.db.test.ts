import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_BATCH_SIZE, runSeed, type SeedReport } from "../../../database/seed/run-seed";
import type { PrismaClient } from "../../generated/prisma/client";
import { countCandidates } from "../../model/candidate-model";
import { createPrismaClient } from "../../model/client";
import { testDatabaseUrl } from "../helpers/test-database";

const HEADER = "sbd,toan,ngu_van,ngoai_ngu,vat_li,hoa_hoc,sinh_hoc,lich_su,dia_li,gdcd,ma_ngoai_ngu";
const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

let prisma: PrismaClient;
let tmp: string;

beforeAll(() => {
  prisma = createPrismaClient(testDatabaseUrl());
  tmp = mkdtempSync(join(tmpdir(), "seed-test-"));
});
afterAll(async () => {
  await prisma.$disconnect();
  rmSync(tmp, { recursive: true, force: true });
});
beforeEach(async () => {
  await prisma.$executeRaw`TRUNCATE TABLE "candidates"`;
});

function csvOf(name: string, rows: string[]): string {
  const path = join(tmp, name);
  writeFileSync(path, [HEADER, ...rows].join("\n") + "\n");
  return path;
}

function seed(csvPath: string, options: { fresh?: boolean; batchSize?: number } = {}): Promise<SeedReport> {
  return runSeed({ csvPath, fresh: options.fresh ?? false, batchSize: options.batchSize ?? DEFAULT_BATCH_SIZE, prisma, log: () => {} });
}

describe("runSeed", () => {
  it("GS-01-AC03/AC04: loads the sample, keeps the leading zero, stores empty cells as NULL and 0 as 0.00", async () => {
    const report = await seed(fixture("sample.csv"));
    expect(report).toMatchObject({ outcome: "seeded", exitCode: 0, dataRows: 7, inserted: 7, tableCount: 7 });

    const rows = await prisma.$queryRaw<
      { sbd: string; toan: string | null; ngoai_ngu: string | null; lich_su: string | null; ma_ngoai_ngu: string | null }[]
    >`SELECT sbd, toan::text AS toan, ngoai_ngu::text AS ngoai_ngu, lich_su::text AS lich_su, ma_ngoai_ngu FROM candidates ORDER BY sbd`;
    expect(rows[0]).toEqual({ sbd: "01000001", toan: "8.40", ngoai_ngu: "8.00", lich_su: null, ma_ngoai_ngu: "N1" });
    expect(rows[2]).toEqual({ sbd: "01000003", toan: "0.00", ngoai_ngu: null, lich_su: null, ma_ngoai_ngu: null });
  });

  it("GS-01-AC02: inserts in batches, including a short last batch", async () => {
    const report = await seed(fixture("sample.csv"), { batchSize: 3 });
    expect(report).toMatchObject({ outcome: "seeded", inserted: 7, batches: 3 });
    expect(await countCandidates(prisma)).toBe(7);
  });

  it("GS-01-AC05: a second run on a full table does nothing and exits 0", async () => {
    await seed(fixture("sample.csv"));
    const report = await seed(fixture("sample.csv"));
    expect(report).toMatchObject({ outcome: "already-full", exitCode: 0, inserted: 0, tableCount: 7 });
    expect(await countCandidates(prisma)).toBe(7);
  });

  it("GS-01-AC05: refuses a table that holds a different number of rows than the CSV", async () => {
    await seed(csvOf("two.csv", ["01000001,5,,,,,,,,,", "01000002,6,,,,,,,,,"]));
    const report = await seed(fixture("sample.csv"));
    expect(report).toMatchObject({ outcome: "refused", inserted: 0 });
    expect(report.exitCode).not.toBe(0);
    expect(await countCandidates(prisma)).toBe(2);
  });

  it("GS-01-AC05: --fresh reloads a full table without doubling it", async () => {
    await seed(fixture("sample.csv"));
    const report = await seed(fixture("sample.csv"), { fresh: true });
    expect(report).toMatchObject({ outcome: "seeded", exitCode: 0, inserted: 7, tableCount: 7 });
    expect(await countCandidates(prisma)).toBe(7);
  });

  it("GS-01-AC05: --fresh also repairs a half-loaded table", async () => {
    await seed(csvOf("two.csv", ["01000001,5,,,,,,,,,", "01000002,6,,,,,,,,,"]));
    const report = await seed(fixture("sample.csv"), { fresh: true });
    expect(report).toMatchObject({ outcome: "seeded", tableCount: 7 });
  });

  it("GS-01-AC06: invalid rows are reported with line numbers and reasons, and nothing is written", async () => {
    const report = await seed(fixture("invalid.csv"));
    expect(report.outcome).toBe("invalid-rows");
    expect(report.exitCode).not.toBe(0);
    expect(report.inserted).toBe(0);
    expect(report.issues).toMatchObject({
      INVALID_SBD: { count: 1, lines: [3] },
      OUT_OF_RANGE: { count: 1, lines: [4] },
      NOT_A_NUMBER: { count: 1, lines: [4] },
      TOO_MANY_DECIMALS: { count: 1, lines: [4] },
      SCORE_WITHOUT_EXAM_CODE: { count: 1, lines: [5] },
      COLUMN_COUNT: { count: 1, lines: [6] },
    });
    expect(await countCandidates(prisma)).toBe(0);
  });

  it("GS-01-AC06: an invalid CSV does not even truncate a full table when --fresh is given", async () => {
    await seed(fixture("sample.csv"));
    const report = await seed(fixture("invalid.csv"), { fresh: true });
    expect(report.outcome).toBe("invalid-rows");
    expect(await countCandidates(prisma)).toBe(7);
  });

  it("GS-01-AC06: stops pass 2 when a row is rejected because the file changed between the passes", async () => {
    const path = csvOf("changes.csv", [
      "01000001,5,,,,,,,,,",
      "01000002,6,,,,,,,,,",
      "01000003,7,,,,,,,,,",
      "01000004,8,,,,,,,,,",
      "01000005,9,,,,,,,,,",
    ]);
    const report = await runSeed({
      csvPath: path,
      fresh: false,
      batchSize: 2,
      prisma,
      log: (line) => {
        // Pass 1 has finished and passed; corrupt line 5 (the 4th data row) just before pass 2 opens the file.
        if (line.startsWith("Lượt 2")) writeFileSync(path, readFileSync(path, "utf8").replace("01000004,8", "1000004,8"));
      },
    });
    expect(report.outcome).toBe("insert-failed");
    expect(report.exitCode).not.toBe(0);
    expect(report.message).toContain("5"); // names the CSV line
    expect(report.message).toContain("INVALID_SBD");
    expect(await countCandidates(prisma)).toBeLessThan(5);
    const rows = await prisma.$queryRaw<{ sbd: string }[]>`SELECT sbd FROM candidates WHERE sbd = '01000005'`;
    expect(rows).toEqual([]); // nothing after the rejected row was loaded
  });

  it("stops on a header that is out of order, before touching the database", async () => {
    await seed(fixture("sample.csv"));
    const report = await seed(fixture("swapped-header.csv"), { fresh: true });
    expect(report.outcome).toBe("bad-header");
    expect(report.exitCode).not.toBe(0);
    expect(await countCandidates(prisma)).toBe(7);
  });

  it("reports a CSV that cannot be opened", async () => {
    const report = await seed(join(tmp, "missing.csv"));
    expect(report.outcome).toBe("file-error");
    expect(report.exitCode).not.toBe(0);
  });

  it("GS-01-AC07: never modifies the CSV it reads", async () => {
    const hash = () => createHash("sha256").update(readFileSync(fixture("sample.csv"))).digest("hex");
    const before = hash();
    await seed(fixture("sample.csv"));
    await seed(fixture("sample.csv"), { fresh: true });
    expect(hash()).toBe(before);
  });
});
