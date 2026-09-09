"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, verifySecret, landingPath } from "@/lib/auth";
import { createOtp, verifyOtp, normalizePhone } from "@/lib/otp";

// Step 1: request an OTP. Only known staff (no self-registration, v2 §3) get a
// code. `devCode` is populated in dev so the login screen can show it.
export type RequestState = {
  sent: boolean;
  phone: string;
  error?: string;
  devCode?: string;
};

export async function requestOtp(
  _prev: RequestState,
  formData: FormData
): Promise<RequestState> {
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  if (phone.length < 10) {
    return { sent: false, phone, error: "Enter a valid phone number." };
  }

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    return {
      sent: false,
      phone,
      error: "This number isn't registered. Ask your clinic admin to add you.",
    };
  }

  const devCode = await createOtp(phone);
  return { sent: true, phone, devCode: devCode ?? undefined };
}

// Step 2: verify the OTP and open a session, then route by role.
export type VerifyState = { error?: string };

export async function verifyAndLogin(
  _prev: VerifyState,
  formData: FormData
): Promise<VerifyState> {
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const code = String(formData.get("code") ?? "");

  const ok = await verifyOtp(phone, code);
  if (!ok) return { error: "Invalid or expired code. Request a new one." };

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) return { error: "Account not found." };

  await createSession({
    userId: user.id,
    clinicId: user.clinicId,
    role: user.role,
    phone: user.phone,
    name: user.name,
  });

  redirect(landingPath(user.role));
}

// Alternative to OTP for quick re-entry on shared machines (v2 §3): phone + PIN.
// Only works once the user has set a PIN from their account screen.
export async function pinLogin(
  _prev: VerifyState,
  formData: FormData
): Promise<VerifyState> {
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const pin = String(formData.get("pin") ?? "");
  if (phone.length < 10 || pin.length < 4) {
    return { error: "Enter your phone number and PIN." };
  }

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || !verifySecret(pin, user.pinHash)) {
    return { error: "Incorrect phone or PIN." };
  }

  await createSession({
    userId: user.id,
    clinicId: user.clinicId,
    role: user.role,
    phone: user.phone,
    name: user.name,
  });

  redirect(landingPath(user.role));
}
