import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { logout } from "../dashboard/actions";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole("admin");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Clinic admin</h1>
          <p className="text-xs text-gray-500">{session.name} · admin</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <Link
            href="/dashboard"
            className="rounded-md border border-gray-300 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-100"
          >
            Dashboard
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-md border border-gray-300 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-100"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="flex-1">{children}</div>
    </div>
  );
}
