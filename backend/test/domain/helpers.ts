import { Score } from "../../domain/score";

// Test helper: Score.parse("9.6") unwrapped. Deliberately takes a string, never a number,
// so tests cannot smuggle floating-point values into the domain.
export function s(raw: string): Score {
  const result = Score.parse(raw);
  if (!result.ok) throw new Error(`test helper: "${raw}" is not a valid Score (${result.reason})`);
  return result.score;
}
