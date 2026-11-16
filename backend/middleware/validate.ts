import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { AppError, type ErrorCode } from "../util/app-error";

const MESSAGES: Partial<Record<ErrorCode, string>> = {
  INVALID_SBD: "SBD must be exactly 8 digits",
  INVALID_PARAMETER: "Invalid parameter",
};

function check(schema: ZodType, value: unknown, code: ErrorCode): void {
  if (!schema.safeParse(value).success) throw new AppError(400, code, MESSAGES[code] ?? "Invalid request");
}

/** Validates req.params; failure becomes AppError(400, code) before any controller or database work. */
export function validateParams(schema: ZodType, code: ErrorCode): RequestHandler {
  return (req, _res, next) => {
    check(schema, req.params, code);
    next();
  };
}

export function validateQuery(schema: ZodType, code: ErrorCode): RequestHandler {
  return (req, _res, next) => {
    check(schema, req.query, code);
    next();
  };
}
