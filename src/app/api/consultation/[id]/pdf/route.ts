import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildConsultationPdf, consultationPdfFilename } from "@/lib/pdf";

// Generate the consultation PDF on demand from the stored transcript + summary
// (spec 3.4). Login-protected — this is clinic staff only.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  // ?download=1 forces the browser to save the file; otherwise it opens inline.
  const download = new URL(req.url).searchParams.has("download");

  let consultation;
  try {
    consultation = await prisma.consultation.findUnique({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Database error." }, { status: 503 });
  }
  if (!consultation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data = {
    name: consultation.name,
    id: consultation.id,
    createdAt: consultation.createdAt,
    summary: consultation.summary,
    transcript: consultation.transcript,
  };

  const pdf = await buildConsultationPdf(data);

  return new NextResponse(new Blob([pdf], { type: "application/pdf" }), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${consultationPdfFilename(data)}"`,
    },
  });
}
