"use client";

import { useActionState } from "react";
import { setPin, type PinState } from "./actions";

const init: PinState = {};
const field = "field";

export default function PinForm() {
  const [state, action, pending] = useActionState(setPin, init);

  return (
    <form action={action} className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="pin" className="label">
          New PIN (4–6 digits)
        </label>
        <input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          required
          className={field}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm" className="label">
          Confirm PIN
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          required
          className={field}
        />
      </div>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-teal-700">{state.ok}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary self-start"
      >
        {pending ? "Saving…" : "Save PIN"}
      </button>
    </form>
  );
}
