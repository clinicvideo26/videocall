"use client";

import { useActionState } from "react";
import { updateClinic, type AdminActionState } from "./actions";

const init: AdminActionState = {};

export default function ClinicForm({
  name,
  whatsappNumber,
}: {
  name: string;
  whatsappNumber: string;
}) {
  const [state, action, pending] = useActionState(updateClinic, init);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="clinic-name" className="label">
          Clinic name
        </label>
        <input
          id="clinic-name"
          name="name"
          defaultValue={name}
          required
          className="field max-w-md"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="clinic-wa" className="label">
          WhatsApp number
        </label>
        <input
          id="clinic-wa"
          name="whatsappNumber"
          type="tel"
          inputMode="tel"
          defaultValue={whatsappNumber}
          placeholder="919876543210"
          className="field max-w-md"
        />
        <p className="text-xs text-slate-400">
          Digits only, international format. This is where consultation PDFs are sent.
        </p>
      </div>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-teal-700">{state.ok}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary self-start"
      >
        {pending ? "Saving…" : "Save clinic"}
      </button>
    </form>
  );
}
