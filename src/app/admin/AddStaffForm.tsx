"use client";

import { useActionState } from "react";
import { addStaff, type AdminActionState } from "./actions";

const init: AdminActionState = {};
const field = "field";

export default function AddStaffForm() {
  const [state, action, pending] = useActionState(addStaff, init);

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="staff-name" className="label">
            Name
          </label>
          <input id="staff-name" name="name" required className={field} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="staff-phone" className="label">
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

        <div className="flex flex-col gap-1.5">
          <label htmlFor="staff-role" className="label">
            Role
          </label>
          <select id="staff-role" name="role" defaultValue="doctor" className={field}>
            <option value="doctor">Doctor</option>
            <option value="reception">Reception</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="staff-specialty" className="label">
            Specialty <span className="font-normal text-slate-400">(doctors, optional)</span>
          </label>
          <input id="staff-specialty" name="specialty" className={field} />
        </div>
      </div>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-teal-700">{state.ok}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary self-start"
      >
        {pending ? "Adding…" : "Add staff member"}
      </button>
    </form>
  );
}
