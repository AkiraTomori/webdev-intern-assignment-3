import { describe, expect, it } from "vitest";
import { Score } from "../../domain/score";
import { s } from "./helpers";

describe("Score.parse", () => {
  it.each(["0", "10", "8.4", "6.75", "10.00", "28.6", "0.05", "007"])(
    "GS-01-AC06: accepts %s (CSV form, Prisma Decimal.toString() form, SQL sum form)",
    (raw) => {
      expect(Score.parse(raw).ok).toBe(true);
    },
  );

  it.each(["abc", " 8", "8 ", "8.", ".5", "1e1", "-1", "+1", "", "8,4", "0x10"])(
    "GS-01-AC06: rejects %j as NOT_A_NUMBER",
    (raw) => {
      expect(Score.parse(raw)).toEqual({ ok: false, reason: "NOT_A_NUMBER" });
    },
  );

  it.each(["8.255", "8.250", "0.001"])(
    "GS-01-AC06: rejects %s as TOO_MANY_DECIMALS before NUMERIC(4,2) could round it silently",
    (raw) => {
      expect(Score.parse(raw)).toEqual({ ok: false, reason: "TOO_MANY_DECIMALS" });
    },
  );

  it("GS-01-AC06: rejects an integer part too large to hold exactly", () => {
    expect(Score.parse("99999999999999999999")).toEqual({ ok: false, reason: "NOT_A_NUMBER" });
  });

  it("GS-05-AC01: Score itself has no 0..10 cap (sums reach 30), the range is the subject's rule", () => {
    expect(Score.parse("11").ok).toBe(true);
    expect(Score.parse("28.6").ok).toBe(true);
  });
});

describe("Score arithmetic and formatting", () => {
  it("GS-04-AC04: sums exactly where binary floating point does not (9.1 + 9.2 + 9.3)", () => {
    expect(9.1 + 9.2 + 9.3).not.toBe(27.6); // JS gives 27.599999999999998: why Score exists
    const total = s("9.1").plus(s("9.2")).plus(s("9.3"));
    expect(total.toString()).toBe("27.6");
    expect(total.toNumber()).toBe(27.6);
  });

  it.each([
    ["0", "0"],
    ["10.00", "10"],
    ["8.40", "8.4"],
    ["6.75", "6.75"],
    ["0.05", "0.05"],
    ["0.5", "0.5"],
    ["28.60", "28.6"],
  ])("formats %s as the shortest exact form %s (hundredths are zero-padded, never 0.05 → 0.5)", (raw, expected) => {
    expect(s(raw).toString()).toBe(expected);
  });

  it("compareTo orders by value and equals ignores trailing zeros", () => {
    expect(s("8").compareTo(s("7.99"))).toBeGreaterThan(0);
    expect(s("7.99").compareTo(s("8"))).toBeLessThan(0);
    expect(s("8.0").compareTo(s("8.00"))).toBe(0);
  });

  it("is immutable: plus returns a new Score", () => {
    const a = s("1.5");
    a.plus(s("1"));
    expect(a.toString()).toBe("1.5");
  });
});
