import "server-only";
import PDFDocument from "pdfkit";

export type ConsultationPdfData = {
  name: string;
  id: string;
  createdAt: Date;
  summary: string | null;
  transcript: string | null;
};

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
    doc.text(`Date / time: ${data.createdAt.toISOString().replace("T", " ").slice(0, 16)} UTC`);
    doc.moveDown(1);

    doc.fontSize(14).font("Helvetica-Bold").text("Summary");
    doc.moveDown(0.3);
    doc.fontSize(11).font("Helvetica").text(data.summary?.trim() || "(No summary available.)", {
      align: "left",
    });
    doc.moveDown(1);

    doc.fontSize(14).font("Helvetica-Bold").text("Full transcript");
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").text(data.transcript?.trim() || "(No transcript recorded.)", {
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
