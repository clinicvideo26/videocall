"use client";

import { useActionState } from "react";
import { addStaff, type AdminActionState } from "./actions";

const init: AdminActionState = {};
const field =
  "rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900";

export default function AddStaffForm() {
  const [state, action, pending] = useActionState(addStaff, init);

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="staff-name" className="text-sm font-medium text-gray-700">
            Name
          </label>
          <input id="staff-name" name="name" required className={field} />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="staff-phone" className="text-sm font-medium text-gray-700">
            Phone number
          </label>
          <input
            id="staff-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            placeholder="919876543210"
            required
            className={field}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="staff-role" className="text-sm font-medium text-gray-700">
            Role
          </label>
          <select id="staff-role" name="role" defaultValue="doctor" className={field}>
            <option value="doctor">Doctor</option>
            <option value="reception">Reception</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="staff-specialty" className="text-sm font-medium text-gray-700">
            Specialty <span className="text-gray-400">(doctors, optional)</span>
          </label>
          <input id="staff-specialty" name="specialty" className={field} />
        </div>
      </div>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-green-700">{state.ok}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add staff member"}
      </button>
    </form>
  );
}
