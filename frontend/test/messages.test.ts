import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ScoreLevel, subjects } from "../../backend/domain";
import { diffKeys, emptyOrNonString, findDuplicateKeys, leafKeys, paramMismatches, type Json } from "./messages-check";

const read = (path: string) => readFileSync(resolve(__dirname, path), "utf8");
const viText = read("../messages/vi.json");
const enText = read("../messages/en.json");
const vi = JSON.parse(viText) as Json;
const en = JSON.parse(enText) as Json;
const viObject = vi as Record<string, Record<string, unknown>>;

/** The backend error codes, read from the one place the backend defines them. */
function backendErrorCodes(): string[] {
  const source = read("../../backend/util/app-error.ts");
  const union = /type ErrorCode\s*=\s*([^;]+);/.exec(source)?.[1] ?? "";
  return [...union.matchAll(/"([A-Z_]+)"/g)].map((match) => match[1]!);
}

describe("message files", () => {
  it("en has exactly the keys of vi", () => {
    expect(diffKeys(vi, en)).toEqual({ missing: [], extra: [] });
  });

  it("every value is a non-empty string", () => {
    expect(emptyOrNonString(vi)).toEqual([]);
    expect(emptyOrNonString(en)).toEqual([]);
  });

  it("vi and en use the same {x} parameters", () => {
    expect(paramMismatches(vi, en)).toEqual([]);
  });

  it("neither file has a duplicate key", () => {
    expect(findDuplicateKeys(viText)).toEqual([]);
    expect(findDuplicateKeys(enText)).toEqual([]);
  });

  it("has all 9 subjects, from the backend domain", () => {
    expect(Object.keys(viObject.subject!).sort()).toEqual([...subjects.codes()].sort());
  });

  it("has all 4 score levels, from the backend domain", () => {
    expect(Object.keys(viObject.level!).sort()).toEqual(ScoreLevel.all.map((level) => level.key).sort());
  });

  it("has a message for every API error code, plus network", () => {
    const codes = backendErrorCodes();
    expect(codes.sort()).toEqual(["CANDIDATE_NOT_FOUND", "INTERNAL_ERROR", "INVALID_PARAMETER", "INVALID_SBD", "NOT_FOUND"]);
    expect(Object.keys(viObject.error!).sort()).toEqual([...codes, "network"].sort());
  });

  it("language names are the same in both files so each can be found from the other (shell.language)", () => {
    for (const file of [vi, en] as Array<{ shell: { language: Record<string, string> } }>) {
      expect(file.shell.language.vi).toBe("Tiếng Việt");
      expect(file.shell.language.en).toBe("English");
    }
  });

  it("has exactly the expected top-level message groups", () => {
    expect(Object.keys(viObject).sort()).toEqual(["common", "error", "errorPage", "home", "level", "lookup", "notFound", "reports", "shell", "subject", "topGroupA"]);
    expect(leafKeys(vi).length).toBeGreaterThan(40);
  });
});
