import { describe, expect, it } from "vitest";
import { parseConfig } from "../../util/config";

const URL = "postgresql://user:secret-pw@localhost:5433/g_scores";

describe("parseConfig", () => {
  it("defaults PORT to 4000", () => {
    expect(parseConfig({ DATABASE_URL: URL })).toEqual({ databaseUrl: URL, port: 4000 });
  });
  it("reads PORT as an integer", () => {
    expect(parseConfig({ DATABASE_URL: URL, PORT: "8080" }).port).toBe(8080);
  });
  it("rejects a missing or empty DATABASE_URL", () => {
    expect(() => parseConfig({})).toThrow(/DATABASE_URL/);
    expect(() => parseConfig({ DATABASE_URL: "" })).toThrow(/DATABASE_URL/);
  });
  it.each(["0", "65536", "abc", "80.5", "-1", " 80"])("rejects PORT %j", (port) => {
    expect(() => parseConfig({ DATABASE_URL: URL, PORT: port })).toThrow(/PORT/);
  });
  it("never puts the connection string in an error", () => {
    try {
      parseConfig({ DATABASE_URL: URL, PORT: "abc" });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain("secret-pw");
    }
  });
});
