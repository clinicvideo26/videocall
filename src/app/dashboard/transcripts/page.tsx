import { prisma } from "@/lib/prisma";
import { deleteConsultation } from "../actions";

export const dynamic = "force-dynamic";

const columns = ["Name", "ID", "Date / time", "Status", ""];

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
          Consultations and their summaries appear here.
        </p>
      </div>

      <div className="overflow-x-auto rounded-md border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-gray-600">
            <tr>
              {columns.map((c, i) => (
                <th key={i} className="px-4 py-2 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dbError ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-red-600">
                  Could not load consultations.
                </td>
              </tr>
            ) : consultations.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
                  No consultations yet.
                </td>
              </tr>
            ) : (
              consultations.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="px-4 py-2">
                    <code className="text-xs text-gray-500">{c.id.slice(0, 10)}…</code>
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {c.createdAt.toISOString().replace("T", " ").slice(0, 16)}
                  </td>
                  <td className="px-4 py-2">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-3">
                      {c.transcript ? (
                        <>
                          <a
                            href={`/api/consultation/${c.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-gray-900 underline"
                          >
                            View PDF
                          </a>
                          <a
                            href={`/api/consultation/${c.id}/pdf?download=1`}
                            className="text-xs font-medium text-gray-900 underline"
                          >
                            Download
                          </a>
                        </>
                      ) : (
                        <span className="text-xs text-gray-300">No PDF</span>
                      )}
                      <form action={deleteConsultation}>
                        <input type="hidden" name="id" value={c.id} />
                        <button
                          type="submit"
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
