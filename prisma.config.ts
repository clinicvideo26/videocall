import path from "node:path";
import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer auto-loads .env for the config file. Load it ourselves
// using Node's built-in loader (no dotenv dependency). Ignore if .env is absent
// (e.g. CI, where DATABASE_URL is already in the environment).
try {
  process.loadEnvFile();
} catch {
  // .env not present — rely on the ambient environment.
}

// Prisma 7 moves the datasource connection URL out of schema.prisma and into
// this config file (used by migrate / introspection commands). The runtime
// PrismaClient gets its connection via a driver adapter (see src/lib/prisma.ts).
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: env("DATABASE_URL"),
  },
});
