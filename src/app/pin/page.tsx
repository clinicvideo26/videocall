import Link from "next/link";
import { requireSession } from "@/lib/auth";
import PinForm from "./PinForm";
import ChangePhoneForm from "./ChangePhoneForm";

export default async function PinPage() {
  const session = await requireSession();
  const home = session.role === "admin" ? "/admin" : "/dashboard";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Account
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Set a quick-entry PIN, or change your phone number.
        </p>
      </div>

      <div className="card p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Quick-entry PIN
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          A short PIN lets you sign in faster on a shared machine, instead of
          waiting for a one-time code each time.
        </p>
        <PinForm />
      </div>

      <div className="card p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Change phone number
        </h2>
        <ChangePhoneForm current={session.phone} />
      </div>

      <Link
        href={home}
        className="text-sm text-slate-500 underline underline-offset-2 hover:text-slate-700"
      >
        ← Back
      </Link>
    </main>
  );
}
