import { Router, type NextFunction, type Request, type Response } from "express";
import { lookupCandidate } from "../controller/candidate-controller";
import { validateParams } from "../middleware/validate";
import { candidateParamsSchema } from "../schema/candidate";
import type { CandidateService } from "../service/candidate-service";
import { AppError } from "../util/app-error";

export function candidateRouter(service: CandidateService): Router {
  const router = Router();
  // An empty SBD is a format error, not "route not found". Matches "/api/candidates" and "/api/candidates/".
  router.get("/", () => {
    throw new AppError(400, "INVALID_SBD", "SBD must be exactly 8 digits");
  });
  router.get("/:sbd", validateParams(candidateParamsSchema, "INVALID_SBD"), lookupCandidate(service));
  // A broken %-escape in :sbd is an SBD format error, not a generic parameter error.
  router.use((error: unknown, _req: Request, _res: Response, next: NextFunction) => {
    next(
      error instanceof URIError ? new AppError(400, "INVALID_SBD", "SBD must be exactly 8 digits") : error,
    );
  });
  return router;
}
