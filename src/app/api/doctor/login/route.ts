import { prisma } from "@/lib/prisma";
import { issueToken, verifySecret } from "@/lib/auth";
import { verifyOtp, normalizePhone } from "@/lib/otp";
import { corsJson, corsPreflight } from "@/lib/cors";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return corsPreflight();
}

// Step 2 of the extension login: exchange phone + OTP code (or phone + PIN) for
// a Bearer token the extension stores and sends on every request. Doctor-only.
export async function POST(req: Request) {
  let phone = "";
  let code = "";
  let pin = "";
  try {
    const body = (await req.json()) as {
      phone?: unknown;
      code?: unknown;
      pin?: unknown;
    };
    phone = normalizePhone(String(body?.phone ?? ""));
    code = String(body?.code ?? "").trim();
    pin = String(body?.pin ?? "").trim();
  } catch {
    return corsJson({ error: "Invalid request body." }, { status: 400 });
  }

  if (phone.length < 10 || (!code && !pin)) {
    return corsJson({ error: "Enter your phone and a code or PIN." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || user.role !== "doctor") {
    return corsJson({ error: "Not a registered doctor." }, { status: 403 });
  }

  // OTP path if a code was supplied, otherwise PIN.
  const ok = code
    ? await verifyOtp(phone, code)
    : verifySecret(pin, user.pinHash);
  if (!ok) {
    return corsJson(
      { error: code ? "Invalid or expired code." : "Incorrect PIN." },
      { status: 401 }
    );
  }

  const token = issueToken({
    userId: user.id,
    clinicId: user.clinicId,
    role: user.role,
    phone: user.phone,
    name: user.name,
  });

  return corsJson({
    token,
    doctor: { name: user.name, specialty: user.specialty },
  });
}
