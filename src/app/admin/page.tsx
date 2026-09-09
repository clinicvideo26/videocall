import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ClinicForm from "./ClinicForm";
import AddStaffForm from "./AddStaffForm";
import { deleteStaff } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await requireRole("admin");

  const clinic = await prisma.clinic.findUnique({
    where: { id: session.clinicId },
  });
  const staff = await prisma.user.findMany({
    where: { clinicId: session.clinicId },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, phone: true, role: true, specialty: true },
  });

  return (
    <div className="flex flex-col gap-8">
      <section className="card p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Clinic details
        </h2>
        <ClinicForm
          name={clinic?.name ?? ""}
          whatsappNumber={clinic?.whatsappNumber ?? ""}
        />
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Staff</h2>
          <p className="mt-1 text-sm text-slate-500">
            Add doctors and reception staff. They sign in with their phone number
            + a one-time code — no self-registration.
          </p>
        </div>

        <ul className="flex flex-col gap-2">
          {staff.map((u) => (
            <li
              key={u.id}
              className="card flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">
                  {u.name}
                  <span className="badge ml-2 bg-slate-100 text-slate-600 capitalize">
                    {u.role}
                  </span>
                  {u.specialty ? (
                    <span className="ml-1 text-xs text-slate-400">· {u.specialty}</span>
                  ) : null}
                </p>
                <p className="text-xs text-slate-500">{u.phone}</p>
              </div>
              {u.id === session.userId ? (
                <span className="text-xs text-slate-400">you</span>
              ) : (
                <form action={deleteStaff}>
                  <input type="hidden" name="id" value={u.id} />
                  <button type="submit" className="btn btn-danger btn-sm">
                    Remove
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>

        <div className="card border-dashed p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">
            Add a staff member
          </h3>
          <AddStaffForm />
        </div>
      </section>
    </div>
  );
}
