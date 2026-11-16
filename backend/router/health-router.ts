import { Router } from "express";
import type { PrismaClient } from "../generated/prisma/client";
import { pingDatabase } from "../model/candidate-model";

export function healthRouter(prisma: PrismaClient): Router {
  const router = Router();
  router.get("/", async (_req, res) => {
    try {
      await pingDatabase(prisma);
      res.json({ data: { status: "ok" } });
    } catch {
      res.status(503).json({ error: { code: "INTERNAL_ERROR", message: "Database unavailable" } });
    }
  });
  return router;
}
