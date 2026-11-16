import { execFileSync } from "node:child_process";
import pg from "pg";
import { testDatabaseUrl } from "./helpers/test-database";

// Rebuild the disposable test database from migrations before every run, so
// "migration runs from an empty database" is checked each time.
export default async function setup(): Promise<void> {
  const url = testDatabaseUrl(); // throws unless the database name ends with _test

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE");
    await client.query("CREATE SCHEMA public");
  } finally {
    await client.end();
  }

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}
