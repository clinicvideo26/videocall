import { redirect } from "next/navigation";
import { getSession, landingPath } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  // Already signed in → skip the form (admins land on the admin screen).
  const session = await getSession();
  if (session) redirect(landingPath(session.role));

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <path d="M3 12h3l2 5 4-12 2 7h4" />
            </svg>
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              Clinic staff login
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Sign in to manage consultations.
            </p>
          </div>
        </div>
        <div className="card p-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
