import express, { type Express } from "express";
import type { PrismaClient } from "./generated/prisma/client";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { apiRouter } from "./router";

/** Dependencies come in as arguments; this file never reads the environment. The whole API is GET, so no body parser. */
export function createApp({ prisma }: { prisma: PrismaClient }): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use("/api", apiRouter(prisma));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
