export type ErrorCode = "INVALID_SBD" | "CANDIDATE_NOT_FOUND" | "INVALID_PARAMETER" | "INTERNAL_ERROR" | "NOT_FOUND";

/** An error the client is allowed to see: HTTP status plus a stable code. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
