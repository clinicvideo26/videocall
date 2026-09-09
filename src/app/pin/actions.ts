"use server";

import { requireSession, hashSecret } from "@/lib/auth";
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
