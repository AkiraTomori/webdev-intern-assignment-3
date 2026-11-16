import { createApp } from "./app";
import { createPrismaClient } from "./model/client";
import { loadConfig } from "./util/config";
import { startServer } from "./util/start-server";

let config;
try {
  config = loadConfig();
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

const prisma = createPrismaClient(config.databaseUrl);
const server = await startServer(createApp({ prisma }), config.port).catch(async (error: Error) => {
  console.error(`Cannot listen on port ${config.port}: ${error.message}`);
  await prisma.$disconnect();
  return process.exit(1);
});
console.log(`G-Scores API listening on port ${config.port}`);

const SHUTDOWN_TIMEOUT_MS = 10_000;
let shuttingDown = false;

function shutdown(): void {
  if (shuttingDown) process.exit(1); // second signal: stop waiting
  shuttingDown = true;
  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref(); // a stuck connection must not block exit forever
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
  server.closeIdleConnections(); // keep-alive sockets would otherwise hold close() open
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
