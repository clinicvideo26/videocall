export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">
        Clinic Consultation Tool
      </h1>
      <p className="max-w-md text-sm text-gray-500">
        Phase 1 scaffold. Video consultation, live transcription, and PDF
        summaries for clinics.
      </p>
      <a
        href="/login"
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
      >
        Staff login
      </a>
    </main>
  );
}
