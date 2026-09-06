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
      <form action={formAction} className="flex max-w-md flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-sm font-medium text-gray-700">
            Patient / reference name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            placeholder="e.g. Priya S."
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create"}
        </button>
      </form>

      {state.status === "error" ? (
        <p role="alert" className="max-w-md text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      {state.status === "success" ? (
        <div className="flex max-w-md flex-col gap-2 rounded-md border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">
            Consultation created for {state.name}.
          </p>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Consultation ID</span>
            <code className="break-all rounded bg-white px-2 py-1 text-xs">
              {state.id}
            </code>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Shareable link</span>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-white px-2 py-1 text-xs">
                {state.link}
              </code>
              <button
                type="button"
                onClick={() => copyLink(state.link)}
                className="shrink-0 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
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
