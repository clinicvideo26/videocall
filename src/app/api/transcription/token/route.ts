import { NextResponse } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { prisma } from "@/lib/prisma";

// Mints a short-lived (15 min) single-use token so the browser can open the
// ElevenLabs realtime WebSocket without ever seeing our API key. The call page
// has no login, so we at least require a real consultation ID before minting.
export async function POST(req: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Transcription is not configured (ELEVENLABS_API_KEY missing)." },
      { status: 503 }
    );
  }

  let consultationId = "";
  try {
    const body = (await req.json()) as { consultationId?: unknown };
    consultationId = String(body?.consultationId ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!consultationId) {
    return NextResponse.json({ error: "Missing consultationId." }, { status: 400 });
  }

  try {
    const found = await prisma.consultation.findUnique({
      where: { id: consultationId },
      select: { id: true },
    });
    if (!found) {
      return NextResponse.json({ error: "Unknown consultation." }, { status: 404 });
    }
  } catch {
    return NextResponse.json(
      { error: "Could not verify consultation." },
      { status: 503 }
    );
  }

  try {
    const client = new ElevenLabsClient({ apiKey });
    const { token } = await client.tokens.singleUse.create("realtime_scribe");
    return NextResponse.json({ token });
  } catch {
    return NextResponse.json(
      { error: "Could not create a transcription token." },
      { status: 502 }
    );
  }
}
