// Insert a test consultation so the call page can be tested without a Daily key.
// Usage: node scripts/seed-test-consultation.mjs [id]
// Reads DATABASE_URL from .env.

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

process.loadEnvFile();

const id = process.argv[2] ?? "testconsult1";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Placeholder room URL — the video area stays blank without a real Daily room,
// but consent + transcription (which use the local mic) work fine.
const roomUrl = "https://example.daily.co/placeholder-no-daily-key";

const row = await prisma.consultation.upsert({
  where: { id },
  update: { name: "Test Patient", roomUrl, status: "waiting", consentAt: null },
  create: { id, name: "Test Patient", roomUrl },
});

console.log("Seeded consultation:");
console.log(`  id:      ${row.id}`);
console.log(`  open:    http://localhost:3000/call/${row.id}`);

await prisma.$disconnect();
