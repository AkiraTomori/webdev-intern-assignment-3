import { defineConfig } from "vitest/config";

// Two projects: `unit` (pure domain, needs no database) and `db` (needs the
// disposable PostgreSQL test database; globalSetup rebuilds it from migrations).
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["test/domain/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "db",
          include: ["test/**/*.test.ts"],
          exclude: ["test/domain/**"],
          globalSetup: ["./test/global-setup.ts"],
          fileParallelism: false, // all DB tests share one disposable database
        },
      },
    ],
  },
});
