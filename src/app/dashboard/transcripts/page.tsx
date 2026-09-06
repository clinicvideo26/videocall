const columns = ["Name", "ID", "Date / time", "Status", ""];

export default function TranscriptsPage() {
  // Empty shell. Listing real consultations from the database, PDF viewing, and
  // per-row delete are wired up in Steps 4 and 9.
  const consultations: never[] = [];

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
            {consultations.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  No consultations yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
