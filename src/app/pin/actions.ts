"use server";

import { requireSession, hashSecret, createSession } from "@/lib/auth";
import { normalizePhone } from "@/lib/otp";
import { prisma } from "@/lib/prisma";

export type PinState = { error?: string; ok?: string };

// Set/replace the current user's quick-re-entry PIN (v2 §3).
export async function setPin(
  _prev: PinState,
  formData: FormData
): Promise<PinState> {
  const session = await requireSession();
  const pin = String(formData.get("pin") ?? "").trim();
  const confirm = String(formData.get("confirm") ?? "").trim();

  if (!/^\d{4,6}$/.test(pin)) return { error: "PIN must be 4 to 6 digits." };
  if (pin !== confirm) return { error: "The two PINs don't match." };

  await prisma.user.update({
    where: { id: session.userId },
    data: { pinHash: hashSecret(pin) },
  });
  return { ok: "PIN saved. You can now sign in with your phone + PIN." };
}

export type PhoneState = { error?: string; ok?: string };

// Change the current user's own phone number (e.g. move the admin off the seed
// demo number onto a real WhatsApp number so login codes reach them). Re-issues
// the session cookie so it reflects the new number.
export async function changePhone(
  _prev: PhoneState,
  formData: FormData
): Promise<PhoneState> {
  const session = await requireSession();
  const phone = normalizePhone(String(formData.get("phone") ?? ""));

  if (phone.length < 10) return { error: "Enter a valid phone number." };
  if (phone === session.phone) return { error: "That's already your number." };

  const existing = await prisma.user.findUnique({
    where: { phone },
    select: { id: true },
  });
  if (existing && existing.id !== session.userId) {
    return { error: "That number is already used by another staff member." };
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { phone },
  });

  // Keep the signed-in session consistent with the new number.
  await createSession({
    userId: session.userId,
    clinicId: session.clinicId,
    role: session.role,
    phone,
    name: session.name,
  });

  return {
    ok: `Phone number changed to ${phone}. Next time you sign in, use it with a WhatsApp code (or your PIN).`,
  };
}
