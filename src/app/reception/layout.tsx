import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logout } from "../dashboard/actions";

export default async function ReceptionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole("reception", "admin");
  const clinic = await prisma.clinic.findUnique({
    where: { id: session.clinicId },
    select: { name: true },
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Reception</h1>
          <p className="text-xs text-gray-500">
            {clinic?.name ?? "Clinic"} · {session.name}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <Link
            href="/pin"
            className="rounded-md border border-gray-300 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-100"
          >
            Set PIN
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
