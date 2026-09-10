import "server-only";

// Daily.co REST API client (only what Phase 1 needs: create a room).
// Endpoint/params verified against https://docs.daily.co/reference/rest-api/rooms/create-room

const DAILY_API_BASE = "https://api.daily.co/v1";
const ROOM_TTL_SECONDS = 24 * 60 * 60; // rooms expire after 24h

export type DailyRoom = { name: string; url: string };

/**
 * Create a PRIVATE Daily room named `name` (security pass). Private means the
 * room URL alone can't join — you need a meeting token, OR you knock and the
 * meeting owner (doctor) admits you. Knocking is enabled so patients (who have
 * no token) wait in a lobby until the doctor lets them in — a leaked/shared link
 * can't get a stranger into the call without the doctor's approval.
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
      privacy: "private",
      properties: {
        exp: Math.floor(Date.now() / 1000) + ROOM_TTL_SECONDS,
        enable_chat: false,
        // Patients without a token knock and the doctor (owner) admits them.
        enable_knocking: true,
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

const TOKEN_TTL_SECONDS = 6 * 60 * 60; // meeting tokens valid 6h

/**
 * Mint a Daily meeting token for a room. The doctor gets an OWNER token so they
 * join a private room directly and can admit knocking patients. (Patients get
 * no token — they knock instead.)
 */
export async function createMeetingToken(opts: {
  roomName: string;
  isOwner: boolean;
  userName?: string;
}): Promise<string> {
  const apiKey = process.env.DAILY_API_KEY;
  if (!apiKey) throw new Error("DAILY_API_KEY is not set.");

  const res = await fetch(`${DAILY_API_BASE}/meeting-tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        room_name: opts.roomName,
        is_owner: opts.isOwner,
        ...(opts.userName ? { user_name: opts.userName } : {}),
        exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
      },
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Daily meeting-token creation failed (HTTP ${res.status}). ${detail}`.trim()
    );
  }

  const data = (await res.json()) as { token: string };
  return data.token;
}
