"use server";

import { prisma } from "@/lib/prisma";
import { summarizeTranscript, patientInstructionsFromSummary } from "@/lib/summary";
import { buildConsultationPdf } from "@/lib/pdf";
import {
  isWhatsAppConfigured,
  sendWhatsAppPdf,
  isInstructionsWhatsAppConfigured,
  sendPatientInstructions,
} from "@/lib/whatsapp";

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

// End of call, step 1 (v2 §6): persist the final transcript and generate the
// Claude summary, then move the consultation to "review" so the doctor can
// check and edit the summary before anything is sent. Does NOT produce or send
// the PDF — that only happens on approveConsultation.
export async function endConsultation(
  id: string,
  transcript: string
): Promise<{
  ok: boolean;
  summary: string;
  patientMessage: string;
  summarized: boolean;
  error?: string;
}> {
  const text = transcript.trim();

  try {
    await prisma.consultation.update({
      where: { id },
      data: { transcript: text, status: "review" },
    });
  } catch {
    return {
      ok: false,
      summary: "",
      patientMessage: "",
      summarized: false,
      error: "Could not save the transcript.",
    };
  }

  if (!text) return { ok: true, summary: "", patientMessage: "", summarized: false };

  let summary = "";
  let summarized = false;
  try {
    summary = await summarizeTranscript(text);
    await prisma.consultation.update({ where: { id }, data: { summary } });
    summarized = true;
  } catch {
    // Transcript is saved; the doctor can write the summary themselves.
  }

  return {
    ok: true,
    summary,
    // Draft patient message from the summary's medication/plan/follow-up parts.
    patientMessage: patientInstructionsFromSummary(summary),
    summarized,
    error: summarized
      ? undefined
      : "Summary could not be generated — you can write it yourself below.",
  };
}

// End of call, step 2 (v2 §6): the doctor approved the (possibly edited)
// summary. Persist it, mark the consultation done, and deliver the PDF to the
// clinic's WhatsApp. WhatsApp is best-effort and never blocks finalising.
export async function approveConsultation(
  id: string,
  summary: string,
  patientMessage: string
): Promise<{
  ok: boolean;
  whatsapp?: WhatsAppStatus;
  patientWhatsapp?: "sent" | "failed";
  error?: string;
}> {
  const finalSummary = summary.trim();
  const finalPatientMessage = patientMessage.trim();

  let record: {
    name: string;
    createdAt: Date;
    transcript: string | null;
    patientPhone: string | null;
  };
  try {
    record = await prisma.consultation.update({
      where: { id },
      data: {
        summary: finalSummary,
        patientMessage: finalPatientMessage || null,
        status: "done",
      },
      select: { name: true, createdAt: true, transcript: true, patientPhone: true },
    });
  } catch {
    return { ok: false, error: "Could not save the summary." };
  }

  // Full record PDF → clinic's WhatsApp (best-effort; also in the Transcripts tab).
  let whatsapp: WhatsAppStatus = "not-configured";
  if (isWhatsAppConfigured()) {
    try {
      const meta = {
        name: record.name,
        id,
        createdAt: record.createdAt,
        summary: finalSummary,
        transcript: record.transcript,
      };
      const pdf = await buildConsultationPdf(meta);
      await sendWhatsAppPdf(pdf, meta);
      whatsapp = "sent";
    } catch (e) {
      whatsapp = "failed";
      console.error("[whatsapp] clinic PDF delivery failed:", e);
    }
  }

  // Patient instructions → patient's WhatsApp (v2 §7; best-effort).
  let patientWhatsapp: "sent" | "failed" | undefined;
  if (
    finalPatientMessage &&
    record.patientPhone &&
    isInstructionsWhatsAppConfigured()
  ) {
    try {
      await sendPatientInstructions({
        patientPhone: record.patientPhone,
        message: finalPatientMessage,
      });
      patientWhatsapp = "sent";
    } catch (e) {
      patientWhatsapp = "failed";
      console.error("[whatsapp] patient instructions failed:", e);
    }
  }

  return { ok: true, whatsapp, patientWhatsapp };
}

