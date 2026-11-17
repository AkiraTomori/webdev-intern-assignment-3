import { isRecord } from "./guards";

/** The five error codes of api.md §1, plus `network` for "no usable answer from the server". */
export const API_ERROR_CODES = ["INVALID_SBD", "CANDIDATE_NOT_FOUND", "INVALID_PARAMETER", "NOT_FOUND", "INTERNAL_ERROR"] as const;
export type ApiErrorKey = (typeof API_ERROR_CODES)[number] | "network";
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiErrorKey };

/**
 * Maps a parsed JSON body of the shape `{ error: ... }` to a message key. Only `code` is read, never
 * `message` (api.md §1). An unknown code or a broken frame is INTERNAL_ERROR. Returns null when the
 * body is not an error body at all.
 */
export function toErrorKey(body: unknown): ApiErrorKey | null {
  if (!isRecord(body) || !("error" in body)) return null;
  const error = body.error;
  const code = isRecord(error) ? error.code : undefined;
  return (API_ERROR_CODES as readonly unknown[]).includes(code) ? (code as ApiErrorKey) : "INTERNAL_ERROR";
}

/**
 * GET a JSON endpoint and return a result instead of throwing (design F1-F3 §2.2).
 * `parse` returns the typed data or null to reject it. Returns null when the request was aborted:
 * the caller has already moved on and must ignore it.
 */
export async function getJson<T>(path: string, parse: (data: unknown) => T | null, signal?: AbortSignal): Promise<ApiResult<T> | null> {
  let response: Response;
  try {
    response = await fetch(path, { signal, headers: { Accept: "application/json" } });
  } catch {
    return signal?.aborted ? null : { ok: false, error: "network" };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // Backend down: the Next rewrite answers 500 with plain text, not the api.md §1 frame.
    return signal?.aborted ? null : { ok: false, error: "network" };
  }

  const errorKey = toErrorKey(body);
  if (errorKey) return { ok: false, error: errorKey };
  if (!response.ok || !isRecord(body) || !("data" in body)) return { ok: false, error: "INTERNAL_ERROR" };

  const data = parse(body.data);
  return data === null ? { ok: false, error: "INTERNAL_ERROR" } : { ok: true, data };
}
