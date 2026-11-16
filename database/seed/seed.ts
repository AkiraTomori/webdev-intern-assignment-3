import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { MAX_BATCH_SIZE } from "../../backend/model/candidate-model";
import { createPrismaClient } from "../../backend/model/client";
import { DEFAULT_BATCH_SIZE, runSeed } from "./run-seed";

// CLI entry: npm run db:seed -w backend -- [--fresh] [--file <csv>] [--batch-size <n>]
// The only place that reads DATABASE_URL. The connection string is never printed.

const DEFAULT_CSV = fileURLToPath(new URL("../../dataset/diem_thi_thpt_2024.csv", import.meta.url));

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function readOptions() {
  let parsed;
  try {
    parsed = parseArgs({
      args: process.argv.slice(2),
      options: {
        fresh: { type: "boolean", default: false },
        file: { type: "string", default: DEFAULT_CSV },
        "batch-size": { type: "string", default: String(DEFAULT_BATCH_SIZE) },
      },
      strict: true,
      allowPositionals: false,
    });
  } catch (error) {
    return fail(`${(error as Error).message}\nCách dùng: db:seed [--fresh] [--file <csv>] [--batch-size <1..${MAX_BATCH_SIZE}>]`);
  }
  const batchSizeText = parsed.values["batch-size"] ?? "";
  const batchSize = Number(batchSizeText);
  if (!/^\d+$/.test(batchSizeText) || batchSize < 1 || batchSize > MAX_BATCH_SIZE) {
    fail(`--batch-size phải là số nguyên từ 1 đến ${MAX_BATCH_SIZE} (nhận được "${batchSizeText}").`);
  }
  return { fresh: parsed.values.fresh === true, csvPath: parsed.values.file ?? DEFAULT_CSV, batchSize };
}

const options = readOptions();

// Same rule as prisma.config.ts: load the repo-root .env if present; real environment variables win.
try {
  process.loadEnvFile(new URL("../../.env", import.meta.url));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) fail("Thiếu biến môi trường DATABASE_URL (sao chép .env.example thành .env).");

const prisma = createPrismaClient(databaseUrl);
try {
  const report = await runSeed({ ...options, prisma, log: (line) => console.log(line) });
  process.exitCode = report.exitCode;
} catch (error) {
  // e.g. the database is unreachable. Print the reason, not the connection string.
  console.error(`Lỗi CSDL: ${(error as Error).message.slice(0, 500)}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
