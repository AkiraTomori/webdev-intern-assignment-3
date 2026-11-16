// Safety rail for DB-backed tests: they wipe the schema, so they may only ever
// run against a database whose name ends with "_test".

export function loadRootEnv(): void {
  try {
    process.loadEnvFile(new URL("../../../.env", import.meta.url));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export function assertTestDatabaseUrl(url: string | undefined): string {
  if (!url) {
    throw new Error("DATABASE_URL_TEST is not set. Copy .env.example to .env.");
  }
  let databaseName: string;
  try {
    databaseName = decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
  } catch {
    throw new Error("DATABASE_URL_TEST is not a valid URL.");
  }
  if (!databaseName.endsWith("_test")) {
    throw new Error(`Refusing to run tests: database name must end with "_test" (got "${databaseName}").`);
  }
  return url;
}

export function testDatabaseUrl(): string {
  loadRootEnv();
  return assertTestDatabaseUrl(process.env.DATABASE_URL_TEST);
}
