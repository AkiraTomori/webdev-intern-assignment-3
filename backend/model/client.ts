import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

// The only place that builds a Prisma Client (Prisma 7 requires a driver adapter).
// The connection string is passed in so this file never reads the environment.
export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
