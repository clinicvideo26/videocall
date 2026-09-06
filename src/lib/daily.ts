import "server-only";

// Daily.co REST API client (only what Phase 1 needs: create a room).
// Endpoint/params verified against https://docs.daily.co/reference/rest-api/rooms/create-room

const DAILY_API_BASE = "https://api.daily.co/v1";
const ROOM_TTL_SECONDS = 24 * 60 * 60; // rooms expire after 24h

export type DailyRoom = { name: string; url: string };

/**
 * Create a Daily room named `name`. Public room with a 24h expiry — good enough
 * for Phase 1. Step 11 (security pass) should switch to private rooms + per-join
 * meeting tokens for real patient data.
 */
export async function createDailyRoom(name: string): Promise<DailyRoom> {
  const apiKey = process.env.DAILY_API_KEY;
  if (!apiKey) {
    throw new Error("DAILY_API_KEY is not set. Add it to .env to create rooms.");
  }

  const res = await fetch(`${DAILY_API_BASE}/rooms`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      privacy: "public",
      properties: {
        exp: Math.floor(Date.now() / 1000) + ROOM_TTL_SECONDS,
        enable_chat: false,
        // We capture audio for transcription ourselves (ElevenLabs, Step 6),
        // so Daily's own cloud recording stays off.
      },
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Daily room creation failed (HTTP ${res.status}). ${detail}`.trim());
  }

  const data = (await res.json()) as { name: string; url: string };
  return { name: data.name, url: data.url };
}
