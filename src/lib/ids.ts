import crypto from "node:crypto";

/**
 * Generate a long, random, hard-to-guess consultation ID (spec 3.2).
 * 24 random bytes → 32 URL-safe characters (base64url: A–Z a–z 0–9 - _).
 * This value doubles as the Daily room name and the /call/{id} path segment,
 * so it must stay within Daily's room-name charset — base64url qualifies.
 */
export function generateConsultationId(): string {
  return crypto.randomBytes(24).toString("base64url");
}
