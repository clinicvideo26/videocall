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
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Clinic details</h2>
        <ClinicForm
          name={clinic?.name ?? ""}
          whatsappNumber={clinic?.whatsappNumber ?? ""}
        />
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-medium">Staff</h2>
          <p className="text-sm text-gray-500">
            Add doctors and reception staff. They sign in with their phone number
            + a one-time code — no self-registration.
          </p>
        </div>

        <ul className="flex flex-col gap-2">
          {staff.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {u.name}
                  <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                    {u.role}
                  </span>
                  {u.specialty ? (
                    <span className="ml-1 text-xs text-gray-400">· {u.specialty}</span>
                  ) : null}
                </p>
                <p className="text-xs text-gray-500">{u.phone}</p>
              </div>
              {u.id === session.userId ? (
                <span className="text-xs text-gray-400">you</span>
              ) : (
                <form action={deleteStaff}>
                  <input type="hidden" name="id" value={u.id} />
                  <button
                    type="submit"
                    className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>

        <div className="rounded-md border border-dashed border-gray-300 p-4">
          <h3 className="mb-3 text-sm font-medium">Add a staff member</h3>
          <AddStaffForm />
        </div>
      </section>
    </div>
  );
}
