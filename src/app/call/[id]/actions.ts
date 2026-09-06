"use server";

import { prisma } from "@/lib/prisma";
import { summarizeTranscript } from "@/lib/summary";

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

// End of call (spec 3.4): persist the final transcript, generate a summary via
// Claude, and mark the consultation done. The summary is best-effort — if it
// fails (no key, API error), the transcript is still saved.
export async function finalizeConsultation(
  id: string,
  transcript: string
): Promise<{ ok: boolean; summarized: boolean; error?: string }> {
  const text = transcript.trim();

  try {
    await prisma.consultation.update({
      where: { id },
      data: { transcript: text, status: "done" },
    });
  } catch {
    return { ok: false, summarized: false, error: "Could not save the transcript." };
  }

  if (!text) return { ok: true, summarized: false };

  try {
    const summary = await summarizeTranscript(text);
    await prisma.consultation.update({ where: { id }, data: { summary } });
    return { ok: true, summarized: true };
  } catch {
    // Transcript is saved; summary can be regenerated later.
    return { ok: true, summarized: false, error: "Transcript saved, but the summary could not be generated." };
  }
}

