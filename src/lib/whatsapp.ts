import "server-only";
import { consultationPdfFilename, type ConsultationPdfData } from "./pdf";

// Deliver the consultation PDF to the clinic's WhatsApp via the Meta WhatsApp
// Cloud API (spec 3.4 / Step 8). Two calls:
//   1. Upload the PDF bytes → get a media id.
//   2. Send a document message to the clinic using the approved template, with
//      the media id in the template's document header.
// Business-initiated messages must use a pre-approved template, hence the
// WHATSAPP_TEMPLATE_NAME requirement. All of this is best-effort at the call
// site — a WhatsApp failure must never block saving the consultation.

const API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;

type WhatsAppConfig = {
  phoneNumberId: string;
  token: string;
  template: string;
  to: string;
  lang: string;
};

export function whatsappConfig(): WhatsAppConfig | null {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const template = process.env.WHATSAPP_TEMPLATE_NAME;
  const to = process.env.CLINIC_WHATSAPP_NUMBER;
  const lang = process.env.WHATSAPP_TEMPLATE_LANG || "en_US";
  if (!phoneNumberId || !token || !template || !to) return null;
  // WhatsApp expects the recipient as digits only, international format.
  return { phoneNumberId, token, template, to: to.replace(/\D/g, ""), lang };
}

export function isWhatsAppConfigured(): boolean {
  return whatsappConfig() !== null;
}

async function uploadMedia(
  cfg: WhatsAppConfig,
  pdf: Uint8Array<ArrayBuffer>,
  filename: string
): Promise<string> {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", "application/pdf");
  form.append("file", new Blob([pdf], { type: "application/pdf" }), filename);

  const res = await fetch(`${GRAPH}/${cfg.phoneNumberId}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}` },
    body: form,
  });
  const data = (await res.json().catch(() => ({}))) as {
    id?: string;
    error?: unknown;
  };
  if (!res.ok || !data.id) {
    throw new Error(
      `WhatsApp media upload failed (${res.status}): ${JSON.stringify(
        data.error ?? data
      )}`
    );
  }
  return data.id;
}

async function sendDocumentTemplate(
  cfg: WhatsAppConfig,
  mediaId: string,
  filename: string
): Promise<void> {
  const payload = {
    messaging_product: "whatsapp",
    to: cfg.to,
    type: "template",
    template: {
      name: cfg.template,
      language: { code: cfg.lang },
      components: [
        {
          type: "header",
          parameters: [
            { type: "document", document: { id: mediaId, filename } },
          ],
        },
      ],
    },
  };

  const res = await fetch(`${GRAPH}/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) {
    throw new Error(
      `WhatsApp send failed (${res.status}): ${JSON.stringify(data.error ?? data)}`
    );
  }
}

// --- Patient appointment message (video flow #4) ----------------------------
// A second, separate template that goes to the PATIENT (not the clinic) with
// the appointment time + join link. Reuses the same WhatsApp number/token as
// the PDF flow; only the template name (and optional language) differ.

const DEFAULT_COUNTRY_CODE = process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || "91";

type AppointmentConfig = {
  phoneNumberId: string;
  token: string;
  template: string;
  lang: string;
};

export function appointmentWhatsAppConfig(): AppointmentConfig | null {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const template = process.env.WHATSAPP_APPOINTMENT_TEMPLATE_NAME;
  // The template was created as "English" (en). Default to that; override with
  // WHATSAPP_APPOINTMENT_TEMPLATE_LANG if you build it in another language.
  const lang = process.env.WHATSAPP_APPOINTMENT_TEMPLATE_LANG || "en";
  if (!phoneNumberId || !token || !template) return null;
  return { phoneNumberId, token, template, lang };
}

export function isAppointmentWhatsAppConfigured(): boolean {
  return appointmentWhatsAppConfig() !== null;
}

/** WhatsApp needs a full international number. A bare 10-digit Indian number
 *  gets the default country code prepended. */
function toRecipient(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `${DEFAULT_COUNTRY_CODE}${digits}` : digits;
}

/**
 * Send the patient their appointment via the appointment template. The link goes
 * in the message BODY (not a URL button), because WhatsApp rewrites/tracks
 * dynamic button URLs and broke our long call links — a body-text URL is sent
 * verbatim and stays tappable. The template BODY must take three variables:
 *   {{1}} patient name   {{2}} appointment time   {{3}} join link
 * Throws the Meta error on failure so the caller can log it (best-effort).
 */
export async function sendPatientAppointment(opts: {
  patientPhone: string;
  name: string;
  timeLabel: string;
  link: string;
}): Promise<void> {
  const cfg = appointmentWhatsAppConfig();
  if (!cfg) throw new Error("Appointment WhatsApp template is not configured.");

  const payload = {
    messaging_product: "whatsapp",
    to: toRecipient(opts.patientPhone),
    type: "template",
    template: {
      name: cfg.template,
      language: { code: cfg.lang },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: opts.name || "there" },
            { type: "text", text: opts.timeLabel },
            { type: "text", text: opts.link },
          ],
        },
      ],
    },
  };

  const res = await fetch(`${GRAPH}/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) {
    throw new Error(
      `WhatsApp appointment send failed (${res.status}): ${JSON.stringify(
        data.error ?? data
      )}`
    );
  }
}

// --- Patient instruction message (video flow §7) ----------------------------
// After the doctor approves the record, send the patient their "how to use your
// medication" + follow-up instructions. A separate approved template; its BODY
// takes one variable: {{1}} the instructions text (doctor-edited).

type InstructionsConfig = {
  phoneNumberId: string;
  token: string;
  template: string;
  lang: string;
};

export function instructionsWhatsAppConfig(): InstructionsConfig | null {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const template = process.env.WHATSAPP_INSTRUCTIONS_TEMPLATE_NAME;
  const lang = process.env.WHATSAPP_INSTRUCTIONS_TEMPLATE_LANG || "en";
  if (!phoneNumberId || !token || !template) return null;
  return { phoneNumberId, token, template, lang };
}

export function isInstructionsWhatsAppConfigured(): boolean {
  return instructionsWhatsAppConfig() !== null;
}

/** Send the patient their doctor-approved instructions. Throws the Meta error
 *  on failure so the caller can log it (best-effort). */
export async function sendPatientInstructions(opts: {
  patientPhone: string;
  message: string;
}): Promise<void> {
  const cfg = instructionsWhatsAppConfig();
  if (!cfg) throw new Error("Instructions WhatsApp template is not configured.");

  const payload = {
    messaging_product: "whatsapp",
    to: toRecipient(opts.patientPhone),
    type: "template",
    template: {
      name: cfg.template,
      language: { code: cfg.lang },
      components: [
        { type: "body", parameters: [{ type: "text", text: opts.message }] },
      ],
    },
  };

  const res = await fetch(`${GRAPH}/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) {
    throw new Error(
      `WhatsApp instructions send failed (${res.status}): ${JSON.stringify(
        data.error ?? data
      )}`
    );
  }
}

// --- Staff login OTP over WhatsApp -------------------------------------------
// Deliver the phone-login code via an approved Authentication template (e.g.
// revive_login_otp) instead of only logging it. Reuses the same number/token.

type OtpConfig = {
  phoneNumberId: string;
  token: string;
  template: string;
  lang: string;
};

export function otpWhatsAppConfig(): OtpConfig | null {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const template = process.env.WHATSAPP_OTP_TEMPLATE_NAME;
  const lang = process.env.WHATSAPP_OTP_TEMPLATE_LANG || "en";
  if (!phoneNumberId || !token || !template) return null;
  return { phoneNumberId, token, template, lang };
}

export function isOtpWhatsAppConfigured(): boolean {
  return otpWhatsAppConfig() !== null;
}

/**
 * Send a login code via the WhatsApp Authentication template. Meta's auth
 * templates require the code in BOTH the body and the copy-code/one-tap button,
 * hence the two components. Throws the Meta error on failure.
 */
export async function sendOtpCode(phone: string, code: string): Promise<void> {
  const cfg = otpWhatsAppConfig();
  if (!cfg) throw new Error("OTP WhatsApp template is not configured.");

  const payload = {
    messaging_product: "whatsapp",
    to: toRecipient(phone),
    type: "template",
    template: {
      name: cfg.template,
      language: { code: cfg.lang },
      components: [
        { type: "body", parameters: [{ type: "text", text: code }] },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: code }],
        },
      ],
    },
  };

  const res = await fetch(`${GRAPH}/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) {
    throw new Error(
      `WhatsApp OTP send failed (${res.status}): ${JSON.stringify(
        data.error ?? data
      )}`
    );
  }
}

// Upload + send. Throws (with the Meta error) on any failure so the caller can
// log it; returns nothing on success.
export async function sendWhatsAppPdf(
  pdf: Uint8Array<ArrayBuffer>,
  meta: ConsultationPdfData
): Promise<void> {
  const cfg = whatsappConfig();
  if (!cfg) throw new Error("WhatsApp is not configured.");
  const filename = consultationPdfFilename(meta);
  const mediaId = await uploadMedia(cfg, pdf, filename);
  await sendDocumentTemplate(cfg, mediaId, filename);
}
