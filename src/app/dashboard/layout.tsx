import { requireSession } from "@/lib/auth";
import { logout } from "./actions";
import DashboardTabs from "./DashboardTabs";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Clinic dashboard</h1>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>{session.user}</span>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-md border border-gray-300 px-3 py-1.5 font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <DashboardTabs />

      <div className="flex-1">{children}</div>
    </div>
  );
}
