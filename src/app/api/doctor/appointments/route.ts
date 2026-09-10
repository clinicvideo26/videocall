import { prisma } from "@/lib/prisma";
import { sessionFromAuthHeader } from "@/lib/auth";
import { formatIst } from "@/lib/time";
import { corsJson, corsPreflight } from "@/lib/cors";

export const dynamic = "force-dynamic";

// Appointments surface 5 min before their scheduled time (not earlier — keeps
// today's queue clean) and drop off a few hours after, so stale no-shows don't
// pile up. In-progress ones stay because they're inherently recent.
const APPEAR_LEAD_MS = 5 * 60 * 1000;
const TRAIL_MS = 3 * 60 * 60 * 1000;

export function OPTIONS() {
  return corsPreflight();
}

// The doctor extension polls this with its Bearer token. Returns only this
// doctor's due appointments.
export async function GET(req: Request) {
  const session = sessionFromAuthHeader(req.headers.get("authorization"));
  if (!session || session.role !== "doctor") {
    return corsJson({ error: "Unauthorized." }, { status: 401 });
  }

  // Absolute base for join links (the extension opens them in a browser tab).
  const base = process.env.APP_URL
    ? process.env.APP_URL.replace(/\/$/, "")
    : `${req.headers.get("x-forwarded-proto") ?? "https"}://${req.headers.get("host") ?? ""}`;

  const now = Date.now();
  const upper = new Date(now + APPEAR_LEAD_MS); // hide until T-5min
  const lower = new Date(now - TRAIL_MS); // drop old no-shows

  let rows;
  try {
    rows = await prisma.consultation.findMany({
      where: {
        doctorId: session.userId,
        clinicId: session.clinicId,
        status: { in: ["registered", "in_room", "active", "review"] },
        scheduledAt: { not: null, lte: upper, gte: lower },
      },
      orderBy: { scheduledAt: "asc" },
      take: 50,
      select: {
        id: true,
        name: true,
        patientPhone: true,
        mode: true,
        status: true,
        scheduledAt: true,
        roomUrl: true,
      },
    });
  } catch {
    return corsJson({ error: "Could not load appointments." }, { status: 503 });
  }

  const appointments = rows.map((c) => ({
    id: c.id,
    name: c.name,
    patientPhone: c.patientPhone,
    mode: c.mode,
    status: c.status,
    scheduledAt: c.scheduledAt?.toISOString() ?? null,
    scheduledLabel: c.scheduledAt ? formatIst(c.scheduledAt) : null,
    // Where the doctor opens the consultation: the video room for online calls,
    // or the in-clinic audio screen for audio. Both are login-gated; the
    // extension opens the URL in a tab.
    joinUrl:
      c.mode === "video"
        ? `${base}/call/${c.id}`
        : `${base}/consultation/${c.id}/audio`,
  }));

  return corsJson({ doctor: session.name, appointments });
}
