import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Auth for clinic staff (v2 §3): login is by phone + OTP, with three roles.
// Sessions are long-lived — the spec wants login to be effectively one-time.
// No external auth service; session signing and PIN hashing use Node crypto.

const COOKIE_NAME = "clinic_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 180; // 180 days ("effectively never again")

export type Role = "admin" | "reception" | "doctor";

export type Session = {
  userId: string;
  clinicId: string;
  role: Role;
  phone: string;
  name: string;
  exp: number;
};

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET is not set (or too short). Add a long random value to .env."
    );
  }
  return secret;
}

// --- scrypt hashing (stored as "scrypt:<saltHex>:<hashHex>") ------------------
// Used for the quick-re-entry PIN. Generic so it can hash any short secret.

export function hashSecret(secret: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(secret, salt, 32);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

/** Verify a plaintext secret against a stored scrypt hash, in constant time. */
export function verifySecret(secret: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, saltHex, hashHex] = parts;
  let expected: Buffer;
  try {
    expected = Buffer.from(hashHex, "hex");
  } catch {
    return false;
  }
  const actual = crypto.scryptSync(secret, Buffer.from(saltHex, "hex"), expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

// --- Session cookie (HMAC-signed "payload.signature") ------------------------

function sign(data: string): string {
  return crypto.createHmac("sha256", getSecret()).update(data).digest("base64url");
}

function createToken(session: Omit<Session, "exp">): string {
  const payload: Session = {
    ...session,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function verifyToken(token: string | undefined): Session | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as Session;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// --- Token helpers for API clients (the doctor browser extension) ------------
// The extension can't use the httpOnly session cookie, so it logs in over a
// JSON API, stores the same signed token, and sends it as `Authorization:
// Bearer <token>`. Same format as the cookie → both verify identically.

export function issueToken(session: Omit<Session, "exp">): string {
  return createToken(session);
}

/** Extract + verify a session from an `Authorization: Bearer <token>` header. */
export function sessionFromAuthHeader(header: string | null): Session | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return verifyToken(m ? m[1] : undefined);
}

// --- Public helpers used by pages / actions ----------------------------------

export async function createSession(session: Omit<Session, "exp">): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, createToken(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifyToken(store.get(COOKIE_NAME)?.value);
}

/** For protected server components: redirect to /login if not authenticated. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Where each role lands after login. */
export function landingPath(role: Role): string {
  if (role === "admin") return "/admin";
  if (role === "reception") return "/reception";
  return "/dashboard";
}

/** Require one of the given roles; redirect to your own home if it doesn't match. */
export async function requireRole(...roles: Role[]): Promise<Session> {
  const session = await requireSession();
  if (!roles.includes(session.role)) redirect(landingPath(session.role));
  return session;
}
