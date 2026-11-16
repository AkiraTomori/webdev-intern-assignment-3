import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { candidateParamsSchema } from "../../schema/candidate";
import { z } from "zod";
import { validateParams, validateQuery } from "../../middleware/validate";
import { AppError } from "../../util/app-error";

// GS-05-AC04: an invalid SBD is rejected before any controller or service runs.
describe("validateParams", () => {
  const run = (sbd: string) => {
    const next = vi.fn();
    const handler = validateParams(candidateParamsSchema, "INVALID_SBD");
    try {
      handler({ params: { sbd } } as unknown as Request, {} as Response, next);
    } catch (error) {
      return { error, next };
    }
    return { error: undefined, next };
  };

  it("calls next for a valid SBD", () => {
    const { error, next } = run("01000001");
    expect(error).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it.each(["1234567", "123456789", "abcdefgh", " 1000001", "０１０００００１"])(
    "rejects %j with 400 INVALID_SBD and never calls next",
    (sbd) => {
      const { error, next } = run(sbd);
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({ status: 400, code: "INVALID_SBD" });
      expect(next).not.toHaveBeenCalled();
    },
  );
});

describe("validateQuery", () => {
  const schema = z.object({ limit: z.string().regex(/^\d+$/) });
  const run = (query: Record<string, string>) => {
    const next = vi.fn();
    try {
      validateQuery(schema, "INVALID_PARAMETER")({ query } as unknown as Request, {} as Response, next);
    } catch (error) {
      return { error, next };
    }
    return { error: undefined, next };
  };

  it("calls next for a valid query", () => {
    expect(run({ limit: "10" }).next).toHaveBeenCalledOnce();
  });

  it("rejects a bad query with 400 INVALID_PARAMETER and never calls next", () => {
    const { error, next } = run({ limit: "ten" });
    expect(error).toMatchObject({ status: 400, code: "INVALID_PARAMETER" });
    expect(next).not.toHaveBeenCalled();
  });
});
