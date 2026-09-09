import Link from "next/link";
import { requireRole } from "@/lib/auth";
import Brand from "../_components/Brand";
import { logout } from "../dashboard/actions";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole("admin");

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-6 py-3">
          <Brand title="Clinic admin" subtitle={`${session.name} · admin`} />
          <div className="flex items-center gap-2">
            <Link href="/reception" className="btn btn-secondary btn-sm">
              Reception
            </Link>
            <Link href="/dashboard" className="btn btn-secondary btn-sm">
              Dashboard
            </Link>
            <Link href="/pin" className="btn btn-secondary btn-sm">
              Set PIN
            </Link>
            <form action={logout}>
              <button type="submit" className="btn btn-ghost btn-sm">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">{children}</div>
    </>
  );
}
