import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NewConsultationForm from "./NewConsultationForm";
import { sendIn } from "./actions";

export const dynamic = "force-dynamic";

const statusStyle: Record<string, string> = {
  registered: "bg-blue-100 text-blue-700",
  in_room: "bg-amber-100 text-amber-700",
  active: "bg-green-100 text-green-700",
  review: "bg-purple-100 text-purple-700",
};

export default async function ReceptionPage() {
  const session = await requireRole("reception", "admin");

  const doctors = await prisma.user.findMany({
    where: { clinicId: session.clinicId, role: "doctor" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, specialty: true },
  });

  const consultations = await prisma.consultation.findMany({
    where: {
      clinicId: session.clinicId,
      status: { in: ["registered", "in_room", "active", "review"] },
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      name: true,
      patientPhone: true,
      mode: true,
      status: true,
      doctor: { select: { name: true } },
    },
  });

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Register a consultation</h2>
        {doctors.length === 0 ? (
          <p className="text-sm text-amber-700">
            No doctors added yet — an admin can add them on the Admin screen. You
            can still register a consultation as unassigned.
          </p>
        ) : null}
        <NewConsultationForm doctors={doctors} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Currently in the clinic</h2>
        {consultations.length === 0 ? (
          <p className="rounded-md border border-gray-200 px-4 py-8 text-center text-sm text-gray-400">
            No active consultations.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {consultations.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {c.name}
                    <span className="ml-2 text-xs text-gray-400">
                      {c.patientPhone}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {c.mode} · {c.doctor?.name ?? "unassigned"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      statusStyle[c.status] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {c.status}
                  </span>
                  {c.status === "registered" ? (
                    <form action={sendIn}>
                      <input type="hidden" name="id" value={c.id} />
                      <button
                        type="submit"
                        className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700"
                      >
                        Send in
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
