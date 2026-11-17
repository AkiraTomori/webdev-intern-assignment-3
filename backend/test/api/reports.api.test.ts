import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GROUP_A, Score, ScoreLevel, subjects, type SubjectCode } from "../../domain";
import type { PrismaClient } from "../../generated/prisma/client";
import { insertCandidateBatch, truncateCandidates, type NewCandidate } from "../../model/candidate-model";
import { createPrismaClient } from "../../model/client";
import { scoreLevelsResponseSchema, topGroupAResponseSchema } from "../../schema/report";
import { testDatabaseUrl } from "../helpers/test-database";
import { startTestServer } from "./start-test-server";

const score = (raw: string): Score => {
  const parsed = Score.parse(raw);
  if (!parsed.ok) throw new Error(`bad fixture score ${raw}`);
  return parsed.score;
};

function candidate(sbd: string, given: Partial<Record<SubjectCode, string>>, maNgoaiNgu: string | null = null): NewCandidate {
  const scores = {} as Record<SubjectCode, Score | null>;
  for (const code of subjects.codes()) scores[code] = given[code] === undefined ? null : score(given[code]);
  return { sbd, scores, maNgoaiNgu };
}

let prisma: PrismaClient;
let baseUrl: string;
let close: () => Promise<void>;

beforeAll(async () => {
  prisma = createPrismaClient(testDatabaseUrl());
  ({ baseUrl, close } = await startTestServer(prisma));
});
afterAll(async () => {
  await close();
  await prisma.$disconnect();
});
beforeEach(async () => {
  await truncateCandidates(prisma);
});

const get = async (path: string) => {
  const res = await fetch(`${baseUrl}${path}`);
  return { res, body: (await res.json()) as any };
};
const seed = (rows: NewCandidate[]) => insertCandidateBatch(prisma, rows);
const sbdOf = (i: number) => String(i).padStart(8, "0");

describe("GET /api/reports/score-levels", () => {
  const BOUNDARY = ["10", "8", "7.99", "6", "5.99", "4", "3.99", "0"];

  it("puts 8.0, 6.0 and 4.0 in the higher level (half-open intervals)", async () => {
    await seed(BOUNDARY.map((toan, i) => candidate(sbdOf(i + 1), { toan })));
    const { res, body } = await get("/api/reports/score-levels");
    expect(res.status).toBe(200);
    const toan = scoreLevelsResponseSchema.parse(body).data.subjects.find((s) => s.code === "toan");
    expect(toan).toMatchObject({ total: 8, counts: { gte8: 2, gte6: 2, gte4: 2, lt4: 2 } });
  });

  it("never counts a subject that was not sat (not as 0, not in lt4)", async () => {
    await seed([
      ...BOUNDARY.map((toan, i) => candidate(sbdOf(i + 1), { toan })),
      candidate("00000101", { ngu_van: "5" }),
      candidate("00000102", { ngu_van: "9" }),
    ]);
    const { body } = await get("/api/reports/score-levels");
    const data = scoreLevelsResponseSchema.parse(body).data;
    const toan = data.subjects.find((s) => s.code === "toan")!;
    expect(toan.total).toBe(8);
    expect(toan.counts).toEqual({ gte8: 2, gte6: 2, gte4: 2, lt4: 2 });
    for (const subject of data.subjects) {
      expect(Object.values(subject.counts).reduce((a, b) => a + b, 0)).toBe(subject.total);
    }
  });

  it("keeps a subject nobody sat, with total 0", async () => {
    await seed([candidate("00000001", { toan: "5" })]);
    const { body } = await get("/api/reports/score-levels");
    const gdcd = body.data.subjects.find((s: any) => s.code === "gdcd");
    expect(gdcd).toEqual({ code: "gdcd", name: "GDCD", total: 0, counts: { gte8: 0, gte6: 0, gte4: 0, lt4: 0 } });
  });

  it("returns all 9 subjects in registry order, ngoai_ngu merging every language code", async () => {
    await seed([
      candidate("00000001", { ngoai_ngu: "9" }, "N1"),
      candidate("00000002", { ngoai_ngu: "3" }, "N4"),
      candidate("00000003", { ngoai_ngu: "5" }, "N2"),
    ]);
    const { body } = await get("/api/reports/score-levels");
    const data = scoreLevelsResponseSchema.parse(body).data;
    expect(data.subjects.map((s) => s.code)).toEqual([...subjects.codes()]);
    expect(data.subjects.map((s) => s.name)).toEqual(subjects.all().map((s) => s.name));
    expect(data.levels.map((l) => l.key)).toEqual(["gte8", "gte6", "gte4", "lt4"]);
    expect(data.levels).toEqual(ScoreLevel.all.map(({ key, label }) => ({ key, label })));
    expect(data.subjects.find((s) => s.code === "ngoai_ngu")).toMatchObject({
      total: 3,
      counts: { gte8: 1, gte6: 0, gte4: 1, lt4: 1 },
    });
  });

  it("returns 200 with all zeros when the table is empty", async () => {
    const { res, body } = await get("/api/reports/score-levels");
    expect(res.status).toBe(200);
    const data = scoreLevelsResponseSchema.parse(body).data;
    expect(data.subjects).toHaveLength(9);
    for (const subject of data.subjects) {
      expect(subject.total).toBe(0);
      expect(Object.values(subject.counts)).toEqual([0, 0, 0, 0]);
    }
  });

  it("contract: every count is an integer number (bigint converted)", async () => {
    await seed([candidate("00000001", { toan: "9" })]);
    const { body } = await get("/api/reports/score-levels");
    for (const subject of body.data.subjects) {
      expect(Number.isInteger(subject.total)).toBe(true);
      for (const n of Object.values(subject.counts)) expect(Number.isInteger(n)).toBe(true);
    }
  });

  it("ignores unknown query parameters", async () => {
    expect((await get("/api/reports/score-levels?foo=1")).res.status).toBe(200);
  });
});

describe("GET /api/reports/top-group-a", () => {
  const trio = (toan: string, vat_li: string, hoa_hoc: string) => ({ toan, vat_li, hoa_hoc });

  it("sums exactly: 9.6 + 9.5 + 9.5 = 28.6", async () => {
    await seed([candidate("00000001", trio("9.6", "9.5", "9.5"))]);
    const { res, body } = await get("/api/reports/top-group-a");
    expect(res.status).toBe(200);
    expect(topGroupAResponseSchema.parse(body).data).toEqual([
      { rank: 1, sbd: "00000001", toan: 9.6, vat_li: 9.5, hoa_hoc: 9.5, total: 28.6 },
    ]);
    expect(body.data[0].total).toBe(28.6);
  });

  it("excludes anyone missing a group subject but keeps a real 0, 0, 0", async () => {
    await seed([
      candidate("00000001", { toan: "10", vat_li: "10" }),
      candidate("00000002", trio("0", "0", "0")),
    ]);
    const { body } = await get("/api/reports/top-group-a");
    expect(body.data).toEqual([{ rank: 1, sbd: "00000002", toan: 0, vat_li: 0, hoa_hoc: 0, total: 0 }]);
  });

  it("breaks ties by SBD ascending as strings, with ranks 1, 2, 3", async () => {
    await seed([
      candidate("10000001", trio("9", "9", "9")),
      candidate("01000002", trio("9", "9", "9")),
      candidate("02000003", trio("9", "9", "9")),
    ]);
    const { body } = await get("/api/reports/top-group-a");
    expect(body.data.map((r: any) => [r.rank, r.sbd])).toEqual([
      [1, "01000002"],
      [2, "02000003"],
      [3, "10000001"],
    ]);
  });

  it("cuts a tie at exactly `limit` rows and is deterministic", async () => {
    await seed([
      candidate("00000001", trio("10", "10", "10")),
      candidate("00000009", trio("9", "9", "9")),
      candidate("00000005", trio("9", "9", "9")),
      candidate("00000007", trio("9", "9", "9")),
    ]);
    const first = await get("/api/reports/top-group-a?limit=2");
    const second = await get("/api/reports/top-group-a?limit=2");
    expect(first.body.data.map((r: any) => r.sbd)).toEqual(["00000001", "00000005"]);
    expect(second.body).toEqual(first.body);
  });

  it("defaults to 10 rows, highest total first, ranks 1…10", async () => {
    await seed(Array.from({ length: 12 }, (_, i) => candidate(sbdOf(i + 1), trio(String(i % 10), "5", "5"))));
    const { body } = await get("/api/reports/top-group-a");
    const data = topGroupAResponseSchema.parse(body).data;
    expect(data).toHaveLength(10);
    expect(data.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const totals = data.map((r) => r.total);
    expect(totals).toEqual([...totals].sort((a, b) => b - a));
  });

  it.each([
    ["limit=3", 3],
    ["limit=20", 12],
    ["limit=05", 5],
  ])("honours ?%s", async (query, expected) => {
    await seed(Array.from({ length: 12 }, (_, i) => candidate(sbdOf(i + 1), trio("5", "5", String(i % 10)))));
    const { res, body } = await get(`/api/reports/top-group-a?${query}`);
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(expected);
  });

  it("each row has rank, sbd, the group's three scores and total, sbd always 8 chars", async () => {
    await seed([candidate("00000042", trio("7.25", "8.5", "6"))]);
    const { body } = await get("/api/reports/top-group-a");
    expect(Object.keys(body.data[0])).toEqual(["rank", "sbd", ...GROUP_A.codes(), "total"]);
    expect(body.data[0].sbd).toHaveLength(8);
    expect(body.data[0].total).toBe(21.75);
  });

  it.each(["0", "21", "-1", "1.5", "abc", "", "1e1", "%205", "100", "1&limit=2"])(
    "rejects ?limit=%s with 400 INVALID_PARAMETER",
    async (value) => {
      const { res, body } = await get(`/api/reports/top-group-a?limit=${value}`);
      expect(res.status).toBe(400);
      expect(body.error.code).toBe("INVALID_PARAMETER");
    },
  );

  it("returns 200 with an empty list when nobody sat all three subjects", async () => {
    expect((await get("/api/reports/top-group-a")).body).toEqual({ data: [] });
    await seed([candidate("00000001", { toan: "10", vat_li: "10" })]);
    expect((await get("/api/reports/top-group-a")).body).toEqual({ data: [] });
  });

  it("ignores unknown query parameters", async () => {
    expect((await get("/api/reports/top-group-a?foo=1")).res.status).toBe(200);
  });
});

describe("unknown report routes", () => {
  it.each(["/api/reports", "/api/reports/x"])("%s is 404 NOT_FOUND", async (path) => {
    const { res, body } = await get(path);
    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
