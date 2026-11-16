import { Router } from "express";
import type { PrismaClient } from "../generated/prisma/client";
import { CandidateService } from "../service/candidate-service";
import { ReportService } from "../service/report-service";
import { candidateRouter } from "./candidate-router";
import { healthRouter } from "./health-router";
import { reportRouter } from "./report-router";

/** Feature routers are mounted here. */
export function apiRouter(prisma: PrismaClient): Router {
  const router = Router();
  router.use("/candidates", candidateRouter(new CandidateService(prisma)));
  router.use("/reports", reportRouter(new ReportService(prisma)));
  router.use("/health", healthRouter(prisma));
  return router;
}
