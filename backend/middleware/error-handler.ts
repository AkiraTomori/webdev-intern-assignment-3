import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError } from "../util/app-error";

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError(404, "NOT_FOUND", "Route not found"));
};

/** Every failure leaves as JSON in the api.md §1 shape. Never the stack, never the connection string. */
export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof AppError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  // A malformed %-escape (e.g. %E0%A4%A) reaches us as a URIError from Express's param decoding.
  // Generic code here; a router that owns a more specific code (candidate-router) converts it earlier.
  if (error instanceof URIError) {
    res.status(400).json({ error: { code: "INVALID_PARAMETER", message: "Invalid parameter" } });
    return;
  }
  const name = error instanceof Error ? error.name : "NonError";
  const message = error instanceof Error ? error.message : String(error);
  console.error(`${name}: ${message.slice(0, 500)}`);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
};
