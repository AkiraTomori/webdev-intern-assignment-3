import { z } from "zod";

export interface Config {
  readonly databaseUrl: string;
  readonly port: number;
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (copy .env.example to .env)"),
  PORT: z
    .string()
    .regex(/^\d+$/, "PORT must be an integer from 1 to 65535")
    .transform(Number)
    .pipe(z.number().int().min(1).max(65535, "PORT must be an integer from 1 to 65535"))
    .default(4000),
});

/** Pure: validates an env-like object. Messages never include the values (the connection string is a secret). */
export function parseConfig(env: Readonly<Record<string, string | undefined>>): Config {
  const result = envSchema.safeParse({
    DATABASE_URL: env.DATABASE_URL === "" ? undefined : env.DATABASE_URL,
    PORT: env.PORT === "" ? undefined : env.PORT,
  });
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid configuration: ${problems.join("; ")}`);
  }
  return { databaseUrl: result.data.DATABASE_URL, port: result.data.PORT };
}

/** The one place that reads process.env. Loads the repo-root .env if present; real variables win. */
export function loadConfig(): Config {
  try {
    process.loadEnvFile(new URL("../../.env", import.meta.url));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return parseConfig(process.env);
}
