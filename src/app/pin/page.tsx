import Link from "next/link";
import { requireSession } from "@/lib/auth";
import PinForm from "./PinForm";

export default async function PinPage() {
  const session = await requireSession();
  const home = session.role === "admin" ? "/admin" : "/dashboard";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Quick-entry PIN</h1>
        <p className="mt-1 text-sm text-gray-500">
          Set a short PIN to sign in faster on a shared machine, instead of
          waiting for a one-time code each time.
        </p>
      </div>

      <PinForm />

      <Link href={home} className="text-sm text-gray-500 underline">
        ← Back
      </Link>
    </main>
  );
}
