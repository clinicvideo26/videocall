import "server-only";
import crypto from "node:crypto";
import { prisma } from "./prisma";
import { hashSecret, verifySecret } from "./auth";

// Phone + OTP challenge store (v2 §3). Codes are stored hashed with a short
// expiry. Delivery is pluggable: in dev the code is logged (and surfaced to the
// login screen) so the whole flow works with no SMS provider; a real WhatsApp /
// SMS sender slots into `deliverOtp` later.

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const isDev = process.env.NODE_ENV !== "production";

/** Digits only — the canonical form we store and match on. */
export function normalizePhone(input: string): string {
  return input.replace(/\D/g, "");
}

async function deliverOtp(phone: string, code: string): Promise<void> {
  // TODO(step 12+): send via WhatsApp/SMS in production.
  console.log(`[otp] login code for ${phone}: ${code}`);
}

/**
 * Create a fresh OTP for `phone`, invalidating any earlier unconsumed ones.
 * Returns the code only in dev (so the login screen can show it); null in prod.
 */
export async function createOtp(phone: string): Promise<string | null> {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");

  await prisma.otpChallenge.updateMany({
    where: { phone, consumed: false },
    data: { consumed: true },
  });
  await prisma.otpChallenge.create({
    data: {
      phone,
      codeHash: hashSecret(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  await deliverOtp(phone, code);
  return isDev ? code : null;
}

/** Verify + consume the newest live OTP for `phone`. */
export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  const challenge = await prisma.otpChallenge.findFirst({
    where: { phone, consumed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) return false;

  const ok = verifySecret(code.trim(), challenge.codeHash);
  if (ok) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumed: true },
    });
  }
  return ok;
}
