import { describe, expect, it } from "vitest";
import { sbdSchema } from "../../backend/schema/sbd";
import { isValidSbd, normalizeSbd } from "../lib/sbd";

const inputs = ["01000001", "1000001", "010000011", "0100000a", "", " 01000001", "０１０００００１", "01000001\n", "0100 0001"];

describe("SBD rule matches the backend (GS-02-AC04)", () => {
  it.each(inputs)("frontend accepts %j exactly when the backend accepts its trimmed form", (input) => {
    expect(isValidSbd(input)).toBe(sbdSchema.safeParse(input.trim()).success);
  });

  it("trims both ends: ' 01000001 ' is valid here, but the backend refuses the untrimmed string on purpose (owner, 17/11/2026)", () => {
    expect(normalizeSbd(" 01000001 ")).toBe("01000001");
    expect(isValidSbd(" 01000001 ")).toBe(true);
    expect(sbdSchema.safeParse(" 01000001 ").success).toBe(false);
  });

  it("does not trim inside: '0100 0001' is invalid", () => {
    expect(isValidSbd("0100 0001")).toBe(false);
  });

  it("rejects an empty or blank value", () => {
    expect(isValidSbd("")).toBe(false);
    expect(isValidSbd("   ")).toBe(false);
  });
});
