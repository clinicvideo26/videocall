import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 connects through a driver adapter rather than a built-in engine.
// The adapter is lazy — it doesn't open a connection until the first query, so
// importing this module is safe even when no database is running.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

// Reuse a single PrismaClient across hot reloads in development so we don't
// exhaust the database connection pool. In production a fresh client is fine.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
