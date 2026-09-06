"use server";

import { prisma } from "@/lib/prisma";

// No login on the call page (spec 3.3). Records the patient's consent against
// an existing consultation, then the client enters the Daily room.
export async function recordConsent(
  id: string,
  consentImprove: boolean
): Promise<{ ok: boolean; error?: string }> {
  try {
    await prisma.consultation.update({
      where: { id },
      data: {
        consentAt: new Date(),
        consentImprove,
        status: "active",
      },
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not record consent. Please try again." };
  }
}
