export const locales = ["vi", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "vi";
export const LOCALE_COOKIE = "NEXT_LOCALE";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** A valid cookie value wins; anything else (missing, empty, "fr", "EN") is the default. Accept-Language is never read (GS-09-AC04). */
export function resolveLocale(cookieValue: string | undefined | null): Locale {
  return (locales as readonly string[]).includes(cookieValue ?? "") ? (cookieValue as Locale) : defaultLocale;
}
