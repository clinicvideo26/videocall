import { prisma } from "@/lib/prisma";
import { createOtp, normalizePhone } from "@/lib/otp";
import { corsJson, corsPreflight } from "@/lib/cors";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return corsPreflight();
}

// Step 1 of the extension login: a doctor requests a one-time code (mirrors the
// web /login OTP, but returns JSON for the extension). Only a registered doctor
// gets a code — no self-registration. `devCode` is returned only in dev/OTP_DEV.
export async function POST(req: Request) {
  let phone = "";
  try {
    const body = (await req.json()) as { phone?: unknown };
    phone = normalizePhone(String(body?.phone ?? ""));
  } catch {
    return corsJson({ error: "Invalid request body." }, { status: 400 });
  }

  if (phone.length < 10) {
    return corsJson({ error: "Enter a valid phone number." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || user.role !== "doctor") {
    return corsJson(
      { error: "This number isn't a registered doctor. Ask your clinic admin." },
      { status: 404 }
    );
  }

  const devCode = await createOtp(phone);
  return corsJson({ sent: true, devCode: devCode ?? undefined });
}
