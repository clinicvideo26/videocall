import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Brand from "@/app/_components/Brand";
import { logout } from "@/app/dashboard/actions";
import AudioConsultation from "./AudioConsultation";

export const dynamic = "force-dynamic";

// Doctor-only in-clinic audio consultation screen. Staff login required (the
// transcript is sensitive, spec 3.3). Records the room microphone — no video.
export default async function AudioConsultationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("doctor", "admin");
  const { id } = await params;

  const consultation = await prisma.consultation.findUnique({
    where: { id },
    select: { name: true, patientPhone: true, mode: true, clinicId: true },
  });
  if (!consultation) notFound();
  // Scope to the staff member's own clinic.
  if (consultation.clinicId && consultation.clinicId !== session.clinicId) {
    notFound();
  }

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-6 py-3">
          <Brand title="In-clinic consultation" subtitle={session.name} />
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="btn btn-secondary btn-sm">
              Dashboard
            </Link>
            <form action={logout}>
              <button type="submit" className="btn btn-ghost btn-sm">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <div className="card mb-5 p-5">
          <h1 className="text-lg font-semibold text-slate-900">
            {consultation.name}
            {consultation.patientPhone ? (
              <span className="ml-2 text-sm font-normal text-slate-400">
                {consultation.patientPhone}
              </span>
            ) : null}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            In-clinic audio consultation. Tap{" "}
            <span className="font-medium">Start transcription</span> to record the
            room microphone; the live transcript is translated to English. When
            you&apos;re done, tap{" "}
            <span className="font-medium">End &amp; save</span> to store the
            transcript, generate the summary, and produce the PDF.
          </p>
        </div>

        <div className="card p-5">
          <AudioConsultation consultationId={id} />
        </div>
      </div>
    </>
  );
}
