import { redirect } from "next/navigation";
import { getSession, landingPath } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  // Already signed in → skip the form (admins land on the admin screen).
  const session = await getSession();
  if (session) redirect(landingPath(session.role));

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Clinic staff login</h1>
        <p className="mt-1 text-sm text-gray-500">
          Sign in to manage consultations.
        </p>
      </div>
      <LoginForm />
    </main>
  );
}
