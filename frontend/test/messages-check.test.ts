import { describe, expect, it } from "vitest";
import { diffKeys, emptyOrNonString, findDuplicateKeys, paramMismatches, paramsOf } from "./messages-check";

// F0-AC07: the checkers must be able to fail. These run on small fixtures.
describe("message checkers fail on bad input (F0-AC07)", () => {
  const vi = { a: { b: "x", c: "y {n}" }, d: "z" };

  it("reports a key missing from the other file", () => {
    expect(diffKeys(vi, { a: { b: "x", c: "y {n}" } })).toEqual({ missing: ["d"], extra: [] });
  });

  it("reports a key that exists only in the other file", () => {
    expect(diffKeys(vi, { a: { b: "x", c: "y {n}", e: "w" }, d: "z" })).toEqual({ missing: [], extra: ["a.e"] });
  });

  it("accepts identical key sets", () => {
    expect(diffKeys(vi, { a: { b: "1", c: "2 {n}" }, d: "3" })).toEqual({ missing: [], extra: [] });
  });

  it("reports a different set of {x} parameters", () => {
    expect(paramMismatches(vi, { a: { b: "x", c: "y {m}" }, d: "z" })).toEqual(["a.c"]);
    expect(paramMismatches(vi, { a: { b: "x", c: "y {n}" }, d: "z" })).toEqual([]);
    expect(paramsOf("{b} and {a}")).toEqual(["a", "b"]);
  });

  it("reports empty or non-string values", () => {
    expect(emptyOrNonString({ a: "", b: "  ", c: 1, d: "ok", e: { f: null } })).toEqual(["a", "b", "c", "e.f"]);
  });

  it("reports a duplicate key that JSON.parse would hide", () => {
    const text = '{ "a": { "b": "1", "b": "2" }, "c": "3" }';
    expect(JSON.parse(text)).toEqual({ a: { b: "2" }, c: "3" });
    expect(findDuplicateKeys(text)).toEqual(["a.b"]);
  });

  it("does not flag the same key name in different objects", () => {
    expect(findDuplicateKeys('{ "a": { "x": "1" }, "b": { "x": "2" }, "c": [ { "x": "3" }, { "x": "4" } ] }')).toEqual([]);
  });

  it("handles escaped quotes in values and keys", () => {
    expect(findDuplicateKeys('{ "a": "he said \\"hi\\"", "a": "2" }')).toEqual(["a"]);
  });
});
