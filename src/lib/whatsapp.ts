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
