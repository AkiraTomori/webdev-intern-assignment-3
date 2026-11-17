import { describe, expect, it } from "vitest";
import { GROUP_A, ScoreLevel, subjects } from "../../backend/domain";
import { GROUP_A_CODES } from "../lib/api/top-group-a";
import { LEVEL_KEYS, SUBJECT_CODES } from "../lib/api/vocabulary";

describe("frontend vocabulary equals the backend domain", () => {
  it("subject codes, in the backend's order", () => {
    expect([...SUBJECT_CODES]).toEqual([...subjects.codes()]);
  });

  it("level keys, in the backend's order", () => {
    expect([...LEVEL_KEYS]).toEqual(ScoreLevel.all.map((level) => level.key));
  });

  it("group A field names", () => {
    expect([...GROUP_A_CODES]).toEqual([...GROUP_A.codes()]);
  });
});
