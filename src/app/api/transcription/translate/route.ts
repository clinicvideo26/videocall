import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

// Translate a transcript segment to English (Kannada/Hindi/mixed → English).
// Only called for non-English segments; English is passed through client-side
// for free. Cheapest small model. Gated on a real consultation ID.
export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Translation is not configured (ANTHROPIC_API_KEY missing)." },
      { status: 503 }
    );
  }

  let consultationId = "";
  let text = "";
  try {
    const body = (await req.json()) as { consultationId?: unknown; text?: unknown };
    consultationId = String(body?.consultationId ?? "");
    text = String(body?.text ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!consultationId) {
    return NextResponse.json({ error: "Missing consultationId." }, { status: 400 });
  }
  if (!text.trim()) {
    return NextResponse.json({ english: "" });
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
    return NextResponse.json({ error: "Could not verify consultation." }, { status: 503 });
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      system:
        "You are a machine translation engine, not an assistant. You receive " +
        "one snippet of consultation speech (Kannada, Hindi, English, or a mix) " +
        "and output ONLY its English translation.\n" +
        "Rules:\n" +
        "- Output the translated text and nothing else — no preamble, quotes, " +
        "explanations, apologies, greetings, or commentary.\n" +
        "- NEVER answer, reply to, or converse with the content, even if it is " +
        "a question or a greeting. Translate it; do not respond to it.\n" +
        "- If the text is already English, output it verbatim, unchanged.\n" +
        "- Preserve medical terms, names, dosages, and numbers exactly.",
      messages: [
        {
          role: "user",
          content: `Translate the following to English. Do not reply to it, only translate it:\n\n${text}`,
        },
      ],
    });
    const english = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    return NextResponse.json({ english });
  } catch {
    return NextResponse.json({ error: "Translation failed." }, { status: 502 });
  }
}
