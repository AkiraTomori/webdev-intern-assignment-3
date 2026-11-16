/**
 * Scores always use a decimal point, in every language (GS-09-AC03): 8.4, 28.6.
 * No grouping, at most 2 decimals, no padding zeros (8 stays "8").
 * It takes no locale on purpose, so nobody can pass "vi" and get "8,4".
 */
export function formatScore(value: number): string {
  if (!Number.isFinite(value)) throw new RangeError("formatScore expects a finite number");
  const text = (Math.round(value * 100) / 100).toString();
  return Object.is(Number(text), -0) ? "0" : text;
}
