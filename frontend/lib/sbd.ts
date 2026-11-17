// The one SBD rule of the frontend. It mirrors backend/schema/sbd.ts and
// test/sbd-rule.test.ts keeps them equal. The frontend trims; the backend does not.
export const SBD_PATTERN = /^\d{8}$/;

export function normalizeSbd(value: string): string {
  return value.trim();
}

export function isValidSbd(value: string): boolean {
  return SBD_PATTERN.test(normalizeSbd(value));
}
