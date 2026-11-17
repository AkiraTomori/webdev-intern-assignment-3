import { afterEach, describe, expect, it, vi } from "vitest";
import { getJson, toErrorKey } from "../lib/api/client";

const parse = (data: unknown) => (typeof data === "number" ? data : null);

function stubFetch(impl: () => Promise<unknown>) {
  vi.stubGlobal("fetch", vi.fn(impl));
}
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

afterEach(() => vi.unstubAllGlobals());

describe("toErrorKey (F0 §7.0)", () => {
  it("returns the code for each of the five api.md §1 codes", () => {
    for (const code of ["INVALID_SBD", "CANDIDATE_NOT_FOUND", "INVALID_PARAMETER", "NOT_FOUND", "INTERNAL_ERROR"]) {
      expect(toErrorKey({ error: { code, message: "ignored" } })).toBe(code);
    }
  });

  it("maps an unknown code or a broken error frame to INTERNAL_ERROR", () => {
    expect(toErrorKey({ error: { code: "TEAPOT" } })).toBe("INTERNAL_ERROR");
    expect(toErrorKey({ error: "boom" })).toBe("INTERNAL_ERROR");
    expect(toErrorKey({ error: null })).toBe("INTERNAL_ERROR");
  });

  it("returns null when the body is not an error body", () => {
    expect(toErrorKey({ data: 1 })).toBeNull();
    expect(toErrorKey(null)).toBeNull();
    expect(toErrorKey([])).toBeNull();
  });
});

describe("getJson (F0 §7.0)", () => {
  it("returns the parsed data on 200", async () => {
    stubFetch(() => json({ data: 7 }));
    expect(await getJson("/api/x", parse)).toEqual({ ok: true, data: 7 });
  });

  it("returns network when fetch throws", async () => {
    stubFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    expect(await getJson("/api/x", parse)).toEqual({ ok: false, error: "network" });
  });

  it("returns network for a plain-text body such as the Next rewrite's Internal Server Error", async () => {
    stubFetch(() => Promise.resolve(new Response("Internal Server Error", { status: 500 })));
    expect(await getJson("/api/x", parse)).toEqual({ ok: false, error: "network" });
  });

  it("returns the code of an api.md §1 error body", async () => {
    stubFetch(() => json({ error: { code: "CANDIDATE_NOT_FOUND", message: "m" } }, 404));
    expect(await getJson("/api/x", parse)).toEqual({ ok: false, error: "CANDIDATE_NOT_FOUND" });
  });

  it("returns INTERNAL_ERROR for an unknown code", async () => {
    stubFetch(() => json({ error: { code: "WEIRD" } }, 500));
    expect(await getJson("/api/x", parse)).toEqual({ ok: false, error: "INTERNAL_ERROR" });
  });

  it("returns INTERNAL_ERROR for a 200 without data, or with data the parser rejects", async () => {
    stubFetch(() => json({ nothing: true }));
    expect(await getJson("/api/x", parse)).toEqual({ ok: false, error: "INTERNAL_ERROR" });
    stubFetch(() => json({ data: "not a number" }));
    expect(await getJson("/api/x", parse)).toEqual({ ok: false, error: "INTERNAL_ERROR" });
  });

  it("returns INTERNAL_ERROR for a non-2xx JSON body that is not an error frame", async () => {
    stubFetch(() => json({ data: 7 }, 500));
    expect(await getJson("/api/x", parse)).toEqual({ ok: false, error: "INTERNAL_ERROR" });
  });

  it("returns null when the request is aborted", async () => {
    const controller = new AbortController();
    stubFetch(() => {
      controller.abort();
      return Promise.reject(new DOMException("aborted", "AbortError"));
    });
    expect(await getJson("/api/x", parse, controller.signal)).toBeNull();
  });
});
