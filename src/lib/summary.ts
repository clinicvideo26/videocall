import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Generate a clinical summary from a consultation transcript using the cheapest
// current small model (Haiku-class). Faithful to the transcript; no invention.
export async function summarizeTranscript(transcript: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set.");

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system:
      "You are a medical scribe. Summarize the following doctor-patient " +
      "consultation transcript into a concise clinical summary for the " +
      "patient's medical record, in English. Use these sections when the " +
      "information is present: Chief complaint, History / symptoms, " +
      "Examination / findings, Assessment, Plan / advice, Medications, " +
      "Follow-up. Be faithful to the transcript and do not invent facts. If " +
      "the transcript is too short or unclear to summarize, say so plainly. " +
      "Output plain text (no markdown).",
    messages: [{ role: "user", content: transcript }],
  });

  return message.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
}
