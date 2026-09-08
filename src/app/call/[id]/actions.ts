"use server";

import { prisma } from "@/lib/prisma";
import { summarizeTranscript } from "@/lib/summary";
import { buildConsultationPdf } from "@/lib/pdf";
import { isWhatsAppConfigured, sendWhatsAppPdf } from "@/lib/whatsapp";

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

type WhatsAppStatus = "sent" | "failed" | "not-configured";

// End of call (spec 3.4): persist the final transcript, generate a summary via
// Claude, mark the consultation done, and deliver the PDF to the clinic's
// WhatsApp. Summary and WhatsApp are both best-effort — if either fails, the
// transcript is still saved.
export async function finalizeConsultation(
  id: string,
  transcript: string
): Promise<{
  ok: boolean;
  summarized: boolean;
  whatsapp?: WhatsAppStatus;
  error?: string;
}> {
  const text = transcript.trim();

  let record: { name: string; createdAt: Date };
  try {
    record = await prisma.consultation.update({
      where: { id },
      data: { transcript: text, status: "done" },
      select: { name: true, createdAt: true },
    });
  } catch {
    return { ok: false, summarized: false, error: "Could not save the transcript." };
  }

  if (!text) return { ok: true, summarized: false };

  let summary: string | null = null;
  let summarized = false;
  try {
    summary = await summarizeTranscript(text);
    await prisma.consultation.update({ where: { id }, data: { summary } });
    summarized = true;
  } catch {
    // Transcript is saved; summary can be regenerated later.
  }

  // Deliver the PDF to the clinic's WhatsApp (Step 8). Never let this fail the
  // save — the PDF is always downloadable from the Transcripts tab regardless.
  let whatsapp: WhatsAppStatus = "not-configured";
  if (isWhatsAppConfigured()) {
    try {
      const pdf = await buildConsultationPdf({
        name: record.name,
        id,
        createdAt: record.createdAt,
        summary,
        transcript: text,
      });
      await sendWhatsAppPdf(pdf, {
        name: record.name,
        id,
        createdAt: record.createdAt,
        summary,
        transcript: text,
      });
      whatsapp = "sent";
    } catch (e) {
      whatsapp = "failed";
      console.error("[whatsapp] delivery failed:", e);
    }
  }

  return {
    ok: true,
    summarized,
    whatsapp,
    error: summarized
      ? undefined
      : "Transcript saved, but the summary could not be generated.",
  };
}

