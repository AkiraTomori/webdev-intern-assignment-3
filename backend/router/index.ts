import { Router } from "express";
import type { PrismaClient } from "../generated/prisma/client";
import { CandidateService } from "../service/candidate-service";
import { candidateRouter } from "./candidate-router";
import { healthRouter } from "./health-router";

/** B3 (reports) and B4 (top 10) mount their routers here. */
export function apiRouter(prisma: PrismaClient): Router {
  const router = Router();
  router.use("/candidates", candidateRouter(new CandidateService(prisma)));
  router.use("/health", healthRouter(prisma));
  return router;
}
