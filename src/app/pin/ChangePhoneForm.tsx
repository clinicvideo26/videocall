"use client";

import { useActionState } from "react";
import { changePhone, type PhoneState } from "./actions";

const init: PhoneState = {};

export default function ChangePhoneForm({ current }: { current: string }) {
  const [state, action, pending] = useActionState(changePhone, init);

  return (
    <form action={action} className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-phone" className="label">
          New phone number
        </label>
        <input
          id="new-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="919876543210"
          required
          className="field"
        />
        <p className="text-xs text-slate-400">
          Currently <span className="font-medium text-slate-500">{current}</span>
          . Use a real WhatsApp number so login codes reach you.
        </p>
      </div>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-teal-700">{state.ok}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary self-start"
      >
        {pending ? "Saving…" : "Change phone number"}
      </button>
    </form>
  );
}
