import { defineConfig } from "prisma/config";

// Prisma 7 no longer loads .env by itself. Load the repo-root .env if present;
// real environment variables win (the file never overrides them).
try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

export default defineConfig({
  schema: "../database/prisma/schema.prisma",
  migrations: { path: "../database/prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
