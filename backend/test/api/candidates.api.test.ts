import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Score, subjects, type SubjectCode } from "../../domain";
import type { PrismaClient } from "../../generated/prisma/client";
import { insertCandidateBatch, truncateCandidates, type NewCandidate } from "../../model/candidate-model";
import { createPrismaClient } from "../../model/client";
import { candidateResponseSchema } from "../../schema/candidate";
import { testDatabaseUrl } from "../helpers/test-database";
import { startTestServer } from "./start-test-server";

const score = (raw: string): Score => {
  const parsed = Score.parse(raw);
  if (!parsed.ok) throw new Error(`bad fixture score ${raw}`);
  return parsed.score;
};

function candidate(sbd: string, given: Partial<Record<SubjectCode, string>>, maNgoaiNgu: string | null): NewCandidate {
  const scores = {} as Record<SubjectCode, Score | null>;
  for (const code of subjects.codes()) scores[code] = given[code] === undefined ? null : score(given[code]);
  return { sbd, scores, maNgoaiNgu };
}

const SAMPLE: NewCandidate[] = [
  candidate("01000001", { toan: "8.4", ngu_van: "6.75", ngoai_ngu: "8.0", vat_li: "6.0", hoa_hoc: "5.25", sinh_hoc: "5.0" }, "N1"),
  candidate("10000001", { toan: "0", ngu_van: "5.5", lich_su: "7.0", dia_li: "8.25", gdcd: "9.0" }, null),
];

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
  await insertCandidateBatch(prisma, SAMPLE);
});

const get = async (path: string) => {
  const res = await fetch(`${baseUrl}${path}`);
  return { res, body: (await res.json()) as any };
};

describe("GET /api/candidates/:sbd", () => {
  it("GS-02-AC01 returns scores for an existing SBD", async () => {
    const { res, body } = await get("/api/candidates/01000001");
    expect(res.status).toBe(200);
    expect(candidateResponseSchema.parse(body).data).toEqual({
      sbd: "01000001",
      scores: { toan: 8.4, ngu_van: 6.75, ngoai_ngu: 8, vat_li: 6, hoa_hoc: 5.25, sinh_hoc: 5, lich_su: null, dia_li: null, gdcd: null },
      foreignLanguageCode: "N1",
    });
    expect(Object.keys(body.data.scores)).toEqual([...subjects.codes()]);
    expect(typeof body.data.scores.toan).toBe("number");
  });

  it("GS-02-AC02 not-taken subjects are null, never 0", async () => {
    const first = await get("/api/candidates/01000001");
    for (const code of ["lich_su", "dia_li", "gdcd"] as const) expect(first.body.data.scores[code]).toBeNull();
    const second = await get("/api/candidates/10000001");
    expect(second.body.data.scores.toan).toBe(0); // a real 0 is not "did not sit"
    expect(second.body.data.scores.vat_li).toBeNull();
  });

  it("GS-02-AC03 valid but unknown SBD returns 404", async () => {
    const { res, body } = await get("/api/candidates/99999999");
    expect(res.status).toBe(404);
    expect(body.error.code).toBe("CANDIDATE_NOT_FOUND");
    expect(body.error.code).not.toBe("INVALID_SBD");
  });

  describe("GS-02-AC04 rejects malformed SBD", () => {
    it.each([
      ["7 digits", "/api/candidates/1234567"],
      ["9 digits", "/api/candidates/123456789"],
      ["letters", "/api/candidates/abcdefgh"],
      ["trailing letter", "/api/candidates/0100000a"],
      ["leading space", "/api/candidates/%2001000001"],
      ["full-width digits", `/api/candidates/${encodeURIComponent("０１０００００１")}`],
      ["broken percent-encoding", "/api/candidates/%E0%A4%A"],
      ["empty (no slash)", "/api/candidates"],
      ["empty (trailing slash)", "/api/candidates/"],
    ])("%s", async (_name, path) => {
      const { res, body } = await get(path);
      expect(res.status).toBe(400);
      expect(res.headers.get("content-type")).toMatch(/application\/json/);
      expect(body).toEqual({ error: { code: "INVALID_SBD", message: "SBD must be exactly 8 digits" } });
    });
  });

  it("GS-02-AC05 keeps leading zero", async () => {
    expect((await get("/api/candidates/01000001")).res.status).toBe(200);
    const stripped = await get("/api/candidates/1000001");
    expect(stripped.res.status).toBe(400);
    expect(stripped.body.data).toBeUndefined();
  });

  it("GS-02-AC06 returns foreign language code", async () => {
    expect((await get("/api/candidates/01000001")).body.data.foreignLanguageCode).toBe("N1");
    expect((await get("/api/candidates/10000001")).body.data.foreignLanguageCode).toBeNull();
  });

  it("hides the framework and returns a JSON 500 without internals when the database fails", async () => {
    const broken = createPrismaClient("postgresql://postgres@127.0.0.1:1/none_test");
    const server = await startTestServer(broken);
    try {
      const res = await fetch(`${server.baseUrl}/api/candidates/01000001`);
      expect(res.status).toBe(500);
      expect(res.headers.get("x-powered-by")).toBeNull();
      expect(await res.json()).toEqual({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
      const health = await fetch(`${server.baseUrl}/api/health`);
      expect(health.status).toBe(503);
      expect(await health.json()).toEqual({ error: { code: "INTERNAL_ERROR", message: "Database unavailable" } });
    } finally {
      await server.close();
      await broken.$disconnect();
    }
  });
});

describe("shared app shell", () => {
  it("unknown route returns JSON 404", async () => {
    const { res, body } = await get("/api/foo");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("health returns ok", async () => {
    const { res, body } = await get("/api/health");
    expect(res.status).toBe(200);
    expect(body).toEqual({ data: { status: "ok" } });
  });
});
