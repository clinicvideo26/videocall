import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Lightweight draft-save of the in-progress transcript so a forgotten
// "End & save" — or a closed tab / dropped call — doesn't lose it. Unlike
// finalizeConsultation this does NOT summarise or mark the consultation done;
// it only persists the latest transcript text. Login-protected (doctor only).
// Called both by a debounced fetch during the call and by navigator.sendBeacon
// on page hide, so it must tolerate being hit frequently.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let text = "";
  try {
    const body = (await req.json()) as { text?: unknown };
    text = String(body?.text ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  if (!text) return NextResponse.json({ ok: true }); // nothing to save yet

  try {
    await prisma.consultation.update({
      where: { id },
      data: { transcript: text },
    });
  } catch {
    return NextResponse.json({ error: "Save failed." }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
