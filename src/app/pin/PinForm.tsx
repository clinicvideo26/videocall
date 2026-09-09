"use client";

import { useActionState } from "react";
import { setPin, type PinState } from "./actions";

const init: PinState = {};
const field =
  "rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900";

export default function PinForm() {
  const [state, action, pending] = useActionState(setPin, init);

  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="pin" className="text-sm font-medium text-gray-700">
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

      <div className="flex flex-col gap-1">
        <label htmlFor="confirm" className="text-sm font-medium text-gray-700">
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
      {state.ok ? <p className="text-sm text-green-700">{state.ok}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save PIN"}
      </button>
    </form>
  );
}
