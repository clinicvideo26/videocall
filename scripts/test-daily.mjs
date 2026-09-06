// End-to-end test of Step 4 (mirrors the createConsultation server action):
// generate ID -> create a real Daily room -> persist -> print the /call link.
// Reads DAILY_API_KEY and DATABASE_URL from .env.

import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

process.loadEnvFile();

const apiKey = process.env.DAILY_API_KEY;
if (!apiKey) {
  console.error("DAILY_API_KEY not set");
  process.exit(1);
}

const id = crypto.randomBytes(24).toString("base64url");

// Same request our src/lib/daily.ts makes.
const res = await fetch("https://api.daily.co/v1/rooms", {
  method: "POST",
  headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    name: id,
    privacy: "public",
    properties: {
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
      enable_chat: false,
    },
  }),
});

if (!res.ok) {
  console.error(`Daily room creation FAILED (HTTP ${res.status}):`);
  console.error(await res.text());
  process.exit(1);
}

const room = await res.json();
console.log("✓ Daily room created");
console.log("  room name:", room.name);
console.log("  room url: ", room.url);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
await prisma.consultation.create({ data: { id, name: "Daily Test", roomUrl: room.url } });
await prisma.$disconnect();

console.log("✓ Saved to database");
console.log("\nJoin the call here:");
console.log(`  http://localhost:3000/call/${id}`);
