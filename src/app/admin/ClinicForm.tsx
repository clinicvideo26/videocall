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
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="clinic-name" className="text-sm font-medium text-gray-700">
          Clinic name
        </label>
        <input
          id="clinic-name"
          name="name"
          defaultValue={name}
          required
          className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="clinic-wa" className="text-sm font-medium text-gray-700">
          WhatsApp number
        </label>
        <input
          id="clinic-wa"
          name="whatsappNumber"
          type="tel"
          inputMode="tel"
          defaultValue={whatsappNumber}
          placeholder="919876543210"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
        />
        <p className="text-xs text-gray-400">
          Digits only, international format. This is where consultation PDFs are sent.
        </p>
      </div>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-green-700">{state.ok}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save clinic"}
      </button>
    </form>
  );
}
