import Link from "next/link";
import { requireSession } from "@/lib/auth";
import Brand from "../_components/Brand";
import { logout } from "./actions";
import DashboardTabs from "./DashboardTabs";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-6 py-3">
          <Brand title="Clinic dashboard" subtitle={session.name} />
          <div className="flex items-center gap-2">
            {session.role === "admin" ? (
              <Link href="/admin" className="btn btn-secondary btn-sm">
                Admin
              </Link>
            ) : null}
            <Link href="/pin" className="btn btn-secondary btn-sm">
              Account
            </Link>
            <form action={logout}>
              <button type="submit" className="btn btn-ghost btn-sm">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-8">
        <DashboardTabs />
        <div className="flex-1">{children}</div>
      </div>
    </>
  );
}
