import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ConsentGate from "./ConsentGate";
import CallFrame from "./CallFrame";

// Branded wrapper (spec 3.2/3.3). Consent screen first; the room only loads
// after the patient agrees (or has already agreed on a previous visit).
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

  // Consent already recorded → straight into the room. Otherwise gate on consent.
  if (consultation.consentAt) {
    return (
      <CallFrame id={id} name={consultation.name} roomUrl={consultation.roomUrl} />
    );
  }

  return (
    <ConsentGate id={id} name={consultation.name} roomUrl={consultation.roomUrl} />
  );
}
