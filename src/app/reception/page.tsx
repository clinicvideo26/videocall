import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatIst } from "@/lib/time";
import NewConsultationForm from "./NewConsultationForm";
import { sendIn } from "./actions";

export const dynamic = "force-dynamic";

const statusStyle: Record<string, string> = {
  registered: "bg-sky-100 text-sky-700",
  in_room: "bg-amber-100 text-amber-700",
  active: "bg-teal-100 text-teal-700",
  review: "bg-violet-100 text-violet-700",
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
    orderBy: [{ scheduledAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 40,
    select: {
      id: true,
      name: true,
      patientPhone: true,
      mode: true,
      status: true,
      scheduledAt: true,
      doctor: { select: { name: true } },
    },
  });

  return (
    <div className="flex flex-col gap-8">
      <section className="card p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Register a consultation
        </h2>
        {doctors.length === 0 ? (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            No doctors added yet — an admin can add them on the Admin screen. You
            can still register a consultation as unassigned.
          </p>
        ) : null}
        <NewConsultationForm doctors={doctors} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-900">
          Currently in the clinic
        </h2>
        {consultations.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center text-sm text-slate-400">
            No active consultations.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {consultations.map((c) => (
              <li
                key={c.id}
                className="card flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {c.name}
                    <span className="ml-2 text-xs text-slate-400">
                      {c.patientPhone}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    <span className="capitalize">{c.mode}</span> ·{" "}
                    {c.doctor?.name ?? "unassigned"}
                    {c.scheduledAt ? (
                      <span className="ml-1 font-medium text-slate-600">
                        · {formatIst(c.scheduledAt)}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`badge capitalize ${
                      statusStyle[c.status] ?? "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {c.status}
                  </span>
                  {c.status === "registered" ? (
                    <form action={sendIn}>
                      <input type="hidden" name="id" value={c.id} />
                      <button
                        type="submit"
                        className="btn btn-primary btn-sm"
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
