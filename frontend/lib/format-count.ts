/**
 * Counts of candidates follow the language: vi 1.045.613, en 1,045,613.
 * Only for whole numbers. Scores never use this: they keep the decimal point everywhere (formatScore).
 */
export function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}
