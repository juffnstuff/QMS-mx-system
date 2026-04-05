import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    // During build time, DATABASE_URL may not be set.
    // Return a client that will fail at query time, not at import time.
    return new Proxy({} as PrismaClient, {
      get(_target, prop) {
        if (prop === "then") return undefined;
        throw new Error(
          "DATABASE_URL is not set. Cannot execute database queries."
        );
      },
    });
  }
  const adapter = new PrismaPg(connectionString);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
