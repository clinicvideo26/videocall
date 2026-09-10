import "server-only";
import PDFDocument from "pdfkit";
import { formatIst } from "./time";

export type ConsultationPdfData = {
  name: string;
  id: string;
  createdAt: Date;
  summary: string | null;
  transcript: string | null;
};

// Word set of a line, lowercased, punctuation stripped — for comparing lines.
function wordSet(line: string): Set<string> {
  return new Set(
    line
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
  );
}

// Drop consecutive near-duplicate lines from a transcript. Older records were
// saved with each segment doubled (Scribe emitted it on two message types); this
// cleans them at render time (and is a harmless no-op on already-clean records).
export function dedupeTranscript(text: string): string {
  const lines = text.split(/\r?\n/);
  const kept: string[] = [];
  for (const line of lines) {
    const prev = kept[kept.length - 1];
    if (prev !== undefined && line.trim() && prev.trim()) {
      const a = wordSet(line);
      const b = wordSet(prev);
      let inter = 0;
      for (const w of a) if (b.has(w)) inter++;
      const union = a.size + b.size - inter;
      const similarity = union === 0 ? 1 : inter / union;
      if (similarity >= 0.8) continue; // near-identical to the previous line
    }
    kept.push(line);
  }
  return kept.join("\n");
}

// Build a consultation PDF (header + summary + full transcript) in-house with
// pdfkit — no headless browser, no external service. pdfkit handles text wrap
// and pagination automatically.
//
// Note: pdfkit's built-in fonts are Latin-only, so non-Latin transcript text
// (Kannada/Hindi script) won't render until the English-translation layer is
// added. English content renders fine.
export function buildConsultationPdf(
  data: ConsultationPdfData
): Promise<Uint8Array<ArrayBuffer>> {
  return new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => {
      const buf = Buffer.concat(chunks);
      // Copy into a Uint8Array backed by a plain ArrayBuffer so it satisfies
      // BlobPart / BodyInit (Node's Buffer is typed over ArrayBufferLike).
      const out = new Uint8Array(buf.byteLength);
      out.set(buf);
      resolve(out);
    });
    doc.on("error", reject);

    doc.fontSize(18).font("Helvetica-Bold").text("Consultation Record", { align: "center" });
    doc.moveDown(1);

    doc.fontSize(11).font("Helvetica");
    doc.text(`Patient / reference: ${data.name}`);
    doc.text(`Consultation ID: ${data.id}`);
    doc.text(`Date / time: ${formatIst(data.createdAt)} IST`);
    doc.moveDown(1);

    doc.fontSize(14).font("Helvetica-Bold").text("Summary");
    doc.moveDown(0.3);
    doc.fontSize(11).font("Helvetica").text(data.summary?.trim() || "(No summary available.)", {
      align: "left",
    });
    doc.moveDown(1);

    doc.fontSize(14).font("Helvetica-Bold").text("Full transcript");
    doc.moveDown(0.3);
    const transcript = dedupeTranscript(data.transcript ?? "").trim();
    doc.fontSize(10).font("Helvetica").text(transcript || "(No transcript recorded.)", {
      align: "left",
    });

    doc.end();
  });
}

// Filename per spec 3.4: Name_ID_Date.pdf (sanitized).
export function consultationPdfFilename(data: ConsultationPdfData): string {
  const date = data.createdAt.toISOString().slice(0, 10);
  return `${data.name}_${data.id}_${date}.pdf`.replace(/[^\w.\-]+/g, "_");
}
