// Generate a scrypt password hash for CLINIC_LOGIN_PASSWORD_HASH.
// Usage:  node scripts/hash-password.mjs "your-password"
// Copy the printed line into your .env (never commit real values).

import crypto from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.mjs "your-password"');
  process.exit(1);
}

const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(password, salt, 64);
const stored = `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;

console.log(`CLINIC_LOGIN_PASSWORD_HASH=${stored}`);
