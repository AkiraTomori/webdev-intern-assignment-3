import { Router } from "express";
import { scoreLevels, topGroupA } from "../controller/report-controller";
import { validateQuery } from "../middleware/validate";
import { topGroupAQuerySchema } from "../schema/report";
import type { ReportService } from "../service/report-service";

export function reportRouter(service: ReportService): Router {
  const router = Router();
  router.get("/score-levels", scoreLevels(service));
  router.get("/top-group-a", validateQuery(topGroupAQuerySchema, "INVALID_PARAMETER"), topGroupA(service));
  return router;
}
