"use client";

import { useActionState, useState } from "react";
import {
  createReceptionConsultation,
  type ReceptionCreateState,
} from "./actions";

const init: ReceptionCreateState = { status: "idle" };
const field = "field";

type Doctor = { id: string; name: string; specialty: string | null };

export default function NewConsultationForm({ doctors }: { doctors: Doctor[] }) {
  const [state, action, pending] = useActionState(createReceptionConsultation, init);
  const [copied, setCopied] = useState(false);

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — reception can copy manually.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="patientPhone" className="label">
            Patient phone
          </label>
          <input
            id="patientPhone"
            name="patientPhone"
            type="tel"
            inputMode="tel"
            placeholder="919876543210"
            required
            className={field}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="label">
            Name <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input id="name" name="name" type="text" placeholder="e.g. Priya S." className={field} />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="scheduledAt" className="label">
            Appointment date &amp; time{" "}
            <span className="font-normal text-slate-400">(required for video)</span>
          </label>
          <input
            id="scheduledAt"
            name="scheduledAt"
            type="datetime-local"
            className={`${field} sm:max-w-xs`}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="doctorId" className="label">
            Doctor
          </label>
          <select id="doctorId" name="doctorId" defaultValue="" className={field}>
            <option value="">— Unassigned —</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.specialty ? ` (${d.specialty})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="label">Mode</span>
          <div className="flex items-center gap-4 pt-2 text-sm text-slate-700">
            <label className="flex items-center gap-1.5">
              <input type="radio" name="mode" value="video" defaultChecked className="accent-teal-600" />
              Video (online)
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="mode" value="audio" className="accent-teal-600" />
              Audio (in-clinic)
            </label>
          </div>
        </div>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="btn btn-primary"
          >
            {pending ? "Registering…" : "Register consultation"}
          </button>
        </div>
      </form>

      {state.status === "error" ? (
        <p role="alert" className="max-w-xl text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      {state.status === "success" ? (
        <div className="flex max-w-xl flex-col gap-2 rounded-lg border border-teal-200 bg-teal-50 p-4">
          <p className="text-sm font-medium text-teal-800">
            Registered {state.name} ({state.mode}).
          </p>
          {state.mode === "video" && state.link ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500">
                Patient link — send this to the patient:
              </span>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
                  {state.link}
                </code>
                <button
                  type="button"
                  onClick={() => copy(state.link!)}
                  className="btn btn-secondary btn-sm shrink-0"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              In-clinic audio consultation — no link. The doctor records from the
              room mic.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
