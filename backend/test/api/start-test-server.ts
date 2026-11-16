import type { AddressInfo } from "node:net";
import type { PrismaClient } from "../../generated/prisma/client";
import { createApp } from "../../app";

/** Starts the real app on a free port. Use Node's built-in fetch against `baseUrl`. */
export async function startTestServer(prisma: PrismaClient): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = createApp({ prisma }).listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}
