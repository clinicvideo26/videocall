import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Brand from "../_components/Brand";
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
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-6 py-3">
          <Brand
            title="Reception"
            subtitle={`${clinic?.name ?? "Clinic"} · ${session.name}`}
          />
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

      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">{children}</div>
    </>
  );
}
