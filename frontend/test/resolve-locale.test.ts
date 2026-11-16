import { describe, expect, it } from "vitest";
import { resolveLocale } from "../i18n/config";

describe("resolveLocale", () => {
  it("is vi when there is no cookie, even if the browser prefers English (F0-AC03, GS-09-AC04)", () => {
    expect(resolveLocale(undefined)).toBe("vi");
    expect(resolveLocale(null)).toBe("vi");
  });

  it("keeps a valid cookie (F0-AC05)", () => {
    expect(resolveLocale("vi")).toBe("vi");
    expect(resolveLocale("en")).toBe("en");
  });

  it("treats an unknown, empty or wrongly cased value as no cookie (F0-AC06)", () => {
    for (const value of ["fr", "", "EN", "en-US", " en"]) expect(resolveLocale(value)).toBe("vi");
  });
});
