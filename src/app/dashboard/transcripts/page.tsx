import { prisma } from "@/lib/prisma";
import { formatIst } from "@/lib/time";
import { deleteConsultation } from "../actions";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string;
  createdAt: Date;
  status: string;
  transcript: string | null;
};

export default async function TranscriptsPage() {
  let consultations: Row[] = [];
  let dbError = false;
  try {
    consultations = await prisma.consultation.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, createdAt: true, status: true, transcript: true },
    });
  } catch {
    dbError = true;
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Transcripts</h2>
        <p className="mt-1 text-sm text-slate-500">
          Consultations and their PDFs appear here. A PDF is available once a
          consultation has been ended &amp; saved.
        </p>
      </div>

      {dbError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-600">
          Could not load consultations.
        </p>
      ) : consultations.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center text-sm text-slate-400">
          No consultations yet.
        </p>
      ) : (
        // Card list (works on phones — the PDF actions are always visible,
        // unlike a wide table whose last column scrolls off-screen).
        <ul className="flex flex-col gap-3">
          {consultations.map((c) => (
            <li key={c.id} className="card flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{c.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatIst(c.createdAt)}
                    {" · "}
                    <code>{c.id.slice(0, 10)}…</code>
                  </p>
                </div>
                <span className="badge shrink-0 bg-slate-100 text-slate-600 capitalize">
                  {c.status}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                {c.transcript ? (
                  <>
                    <a
                      href={`/api/consultation/${c.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                    >
                      View PDF
                    </a>
                    <a
                      href={`/api/consultation/${c.id}/pdf?download=1`}
                      className="btn btn-primary btn-sm"
                    >
                      Download PDF
                    </a>
                  </>
                ) : (
                  <span className="text-xs text-slate-400">
                    No PDF yet — not ended &amp; saved.
                  </span>
                )}
                <form action={deleteConsultation} className="ml-auto">
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" className="btn btn-danger btn-sm">
                    Delete
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
