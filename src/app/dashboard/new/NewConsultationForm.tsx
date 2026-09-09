"use client";

import { useActionState, useState } from "react";
import { createConsultation, type CreateState } from "./actions";

const initialState: CreateState = { status: "idle" };

export default function NewConsultationForm() {
  const [state, formAction, pending] = useActionState(createConsultation, initialState);
  const [copied, setCopied] = useState(false);

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — user can copy manually.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex max-w-md flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="label">
            Patient / reference name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            placeholder="e.g. Priya S."
            required
            className="field"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary w-fit"
        >
          {pending ? "Creating…" : "Create consultation"}
        </button>
      </form>

      {state.status === "error" ? (
        <p role="alert" className="max-w-md text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      {state.status === "success" ? (
        <div className="flex max-w-md flex-col gap-3 rounded-lg border border-teal-200 bg-teal-50 p-4">
          <p className="text-sm font-medium text-teal-800">
            Consultation created for {state.name}.
          </p>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">
              Consultation ID
            </span>
            <code className="break-all rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
              {state.id}
            </code>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">
              Shareable link
            </span>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
                {state.link}
              </code>
              <button
                type="button"
                onClick={() => copyLink(state.link)}
                className="btn btn-secondary btn-sm shrink-0"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
