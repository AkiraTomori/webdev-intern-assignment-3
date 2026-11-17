// The one SBD rule of the frontend (design F1-F3 §3.3). It mirrors backend/schema/sbd.ts and
// test/sbd-rule.test.ts keeps them equal. The frontend trims; the backend does not (§3.2).
export const SBD_PATTERN = /^\d{8}$/;

export function normalizeSbd(value: string): string {
  return value.trim();
}

export function isValidSbd(value: string): boolean {
  return SBD_PATTERN.test(normalizeSbd(value));
}
