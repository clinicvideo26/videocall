"use client";

import { useActionState, useState } from "react";
import {
  createReceptionConsultation,
  type ReceptionCreateState,
} from "./actions";

const init: ReceptionCreateState = { status: "idle" };
const field =
  "rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900";

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
        <div className="flex flex-col gap-1">
          <label htmlFor="patientPhone" className="text-sm font-medium text-gray-700">
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

        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-sm font-medium text-gray-700">
            Name <span className="text-gray-400">(optional)</span>
          </label>
          <input id="name" name="name" type="text" placeholder="e.g. Priya S." className={field} />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="doctorId" className="text-sm font-medium text-gray-700">
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

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Mode</span>
          <div className="flex items-center gap-4 pt-2 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="radio" name="mode" value="video" defaultChecked />
              Video (online)
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="mode" value="audio" />
              Audio (in-clinic)
            </label>
          </div>
        </div>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
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
        <div className="flex max-w-xl flex-col gap-2 rounded-md border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">
            Registered {state.name} ({state.mode}).
          </p>
          {state.mode === "video" && state.link ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">
                Patient link — send this to the patient:
              </span>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-white px-2 py-1 text-xs">
                  {state.link}
                </code>
                <button
                  type="button"
                  onClick={() => copy(state.link!)}
                  className="shrink-0 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              In-clinic audio consultation — no link. The doctor records from the
              room mic.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
