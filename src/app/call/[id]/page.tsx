import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { createMeetingToken } from "@/lib/daily";
import JoinGate from "./JoinGate";

// Branded wrapper (spec 3.2/3.3). The visitor first picks a role (Doctor /
// Patient); the doctor view (with the transcript) still requires a staff login,
// so choosing "Doctor" without a session is bounced to login.
export default async function CallPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let consultation:
    | { name: string; roomUrl: string; consentAt: Date | null }
    | null;
  try {
    consultation = await prisma.consultation.findUnique({
      where: { id },
      select: { name: true, roomUrl: true, consentAt: true },
    });
  } catch {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <h1 className="text-lg font-medium">Consultation unavailable</h1>
        <p className="text-sm text-gray-500">
          Could not load this consultation. Please try again shortly.
        </p>
      </main>
    );
  }

  if (!consultation) notFound();

  // Only a logged-in staff member gets an owner meeting token (so they join the
  // private room directly and can admit patients). Patients get no token and
  // must knock. Minting only for a session means the token never reaches a
  // patient's page.
  const session = await getSession();
  const isDoctor = !!session;
  let doctorToken: string | undefined;
  if (isDoctor && consultation.roomUrl) {
    try {
      doctorToken = await createMeetingToken({
        roomName: id,
        isOwner: true,
        userName: "Doctor",
      });
    } catch (e) {
      console.error("[daily] doctor token mint failed:", e);
    }
  }

  return (
    <JoinGate
      id={id}
      name={consultation.name}
      roomUrl={consultation.roomUrl}
      isDoctor={isDoctor}
      consentAlready={!!consultation.consentAt}
      doctorToken={doctorToken}
    />
  );
}
