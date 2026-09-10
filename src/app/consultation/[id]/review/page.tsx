import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Brand from "@/app/_components/Brand";
import { logout } from "@/app/dashboard/actions";
import ReviewSummary from "@/app/call/[id]/ReviewSummary";

export const dynamic = "force-dynamic";

// Doctor-only summary review screen (v2 §6). Reached from the queue for a
// consultation awaiting review (or to re-open a finalised one). Shows the
// editable summary + the transcript for reference.
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("doctor", "admin");
  const { id } = await params;

  const c = await prisma.consultation.findUnique({
    where: { id },
    select: {
      name: true,
      patientPhone: true,
      summary: true,
      transcript: true,
      status: true,
      clinicId: true,
    },
  });
  if (!c) notFound();
  if (c.clinicId && c.clinicId !== session.clinicId) notFound();

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-6 py-3">
          <Brand title="Review consultation" subtitle={session.name} />
          <div className="flex items-center gap-2">
            <Link href="/dashboard/queue" className="btn btn-secondary btn-sm">
              Queue
            </Link>
            <form action={logout}>
              <button type="submit" className="btn btn-ghost btn-sm">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-6 py-8">
        <div className="card p-5">
          <h1 className="text-lg font-semibold text-slate-900">
            {c.name}
            {c.patientPhone ? (
              <span className="ml-2 text-sm font-normal text-slate-400">
                {c.patientPhone}
              </span>
            ) : null}
          </h1>
          {c.status === "done" ? (
            <p className="mt-1 text-sm text-slate-500">
              Already finalised. Editing and approving again will re-save and
              re-send the PDF.
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-500">
              Awaiting your review before the record is finalised and sent.
            </p>
          )}
        </div>

        <div className="card p-5">
          <ReviewSummary consultationId={id} initialSummary={c.summary ?? ""} />
        </div>

        <details className="card p-5">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">
            Full transcript
          </summary>
          <pre className="mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap font-sans text-sm text-slate-700">
            {c.transcript || "(No transcript recorded.)"}
          </pre>
        </details>
      </div>
    </>
  );
}
