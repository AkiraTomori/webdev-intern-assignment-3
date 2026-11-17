import { describe, expect, it } from "vitest";
import { DEFAULT_TOP_LIMIT, topGroupAQuerySchema } from "../../schema/report";

describe("topGroupAQuerySchema", () => {
  it("accepts a missing limit; the default is applied by the controller", () => {
    expect(topGroupAQuerySchema.parse({})).toEqual({});
    expect(DEFAULT_TOP_LIMIT).toBe(10);
  });

  it.each([
    ["1", 1],
    ["10", 10],
    ["20", 20],
    ["05", 5],
  ])("accepts limit=%s as %i", (raw, expected) => {
    expect(topGroupAQuerySchema.parse({ limit: raw })).toEqual({ limit: expected });
  });

  it.each(["0", "00", "21", "100", "-1", "1.5", "abc", "", "1e1", " 5", "5 ", "+5", "0x5"])(
    "rejects limit=%j",
    (raw) => {
      expect(topGroupAQuerySchema.safeParse({ limit: raw }).success).toBe(false);
    },
  );

  it("rejects a repeated key (array)", () => {
    expect(topGroupAQuerySchema.safeParse({ limit: ["1", "2"] }).success).toBe(false);
  });

  it("ignores unknown parameters", () => {
    expect(topGroupAQuerySchema.parse({ foo: "1", limit: "3" })).toEqual({ limit: 3 });
  });
});
