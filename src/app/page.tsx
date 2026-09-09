export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 p-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-sm">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-7 w-7"
          aria-hidden="true"
        >
          <path d="M3 12h3l2 5 4-12 2 7h4" />
        </svg>
      </span>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Clinic Consultation Tool
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          Video consultation, live transcription, and PDF summaries for clinics.
        </p>
      </div>
      <a href="/login" className="btn btn-primary">
        Staff login
      </a>
    </main>
  );
}
