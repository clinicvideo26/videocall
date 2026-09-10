import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatIst } from "@/lib/time";

export const dynamic = "force-dynamic";

const statusStyle: Record<string, string> = {
  registered: "bg-sky-100 text-sky-700",
  in_room: "bg-amber-100 text-amber-700",
  active: "bg-teal-100 text-teal-700",
  review: "bg-violet-100 text-violet-700",
};

// The doctor's own queue on the website (the extension shows the same list, but
// this works with no extension). Lists consultations assigned to the logged-in
// doctor that are still open, soonest appointment first, with a button to open
// the video call or start the in-clinic audio consultation.
export default async function QueuePage() {
  const session = await requireSession();

  const consultations = await prisma.consultation.findMany({
    where: {
      clinicId: session.clinicId,
      doctorId: session.userId,
      status: { in: ["registered", "in_room", "active", "review"] },
    },
    orderBy: [
      { scheduledAt: { sort: "asc", nulls: "last" } },
      { createdAt: "desc" },
    ],
    take: 50,
    select: {
      id: true,
      name: true,
      patientPhone: true,
      mode: true,
      status: true,
      scheduledAt: true,
    },
  });

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">My queue</h2>
        <p className="mt-1 text-sm text-slate-500">
          Consultations assigned to you. Open the video call, or start an
          in-clinic audio consultation.
        </p>
      </div>

      {consultations.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center text-sm text-slate-400">
          No consultations assigned to you yet.
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
                  <span className="capitalize">{c.mode}</span>
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
                <Link
                  href={
                    c.mode === "video"
                      ? `/call/${c.id}`
                      : `/consultation/${c.id}/audio`
                  }
                  className="btn btn-primary btn-sm"
                >
                  {c.mode === "video" ? "Join" : "Start"}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
