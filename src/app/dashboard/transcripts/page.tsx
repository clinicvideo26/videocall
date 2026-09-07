import { prisma } from "@/lib/prisma";
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
        <h2 className="text-lg font-medium">Transcripts</h2>
        <p className="text-sm text-gray-500">
          Consultations and their PDFs appear here. A PDF is available once a
          consultation has been ended &amp; saved.
        </p>
      </div>

      {dbError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-600">
          Could not load consultations.
        </p>
      ) : consultations.length === 0 ? (
        <p className="rounded-md border border-gray-200 px-4 py-8 text-center text-sm text-gray-400">
          No consultations yet.
        </p>
      ) : (
        // Card list (works on phones — the PDF actions are always visible,
        // unlike a wide table whose last column scrolls off-screen).
        <ul className="flex flex-col gap-3">
          {consultations.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-3 rounded-md border border-gray-200 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {c.createdAt.toISOString().replace("T", " ").slice(0, 16)} UTC
                    {" · "}
                    <code>{c.id.slice(0, 10)}…</code>
                  </p>
                </div>
                <span className="shrink-0 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                  {c.status}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {c.transcript ? (
                  <>
                    <a
                      href={`/api/consultation/${c.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-100"
                    >
                      View PDF
                    </a>
                    <a
                      href={`/api/consultation/${c.id}/pdf?download=1`}
                      className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700"
                    >
                      Download PDF
                    </a>
                  </>
                ) : (
                  <span className="text-xs text-gray-400">
                    No PDF yet — not ended &amp; saved.
                  </span>
                )}
                <form action={deleteConsultation} className="ml-auto">
                  <input type="hidden" name="id" value={c.id} />
                  <button
                    type="submit"
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
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
