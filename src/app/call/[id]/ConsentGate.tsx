"use client";

import { useState, useTransition } from "react";
import { recordConsent } from "./actions";
import CallFrame from "./CallFrame";

// Consent copy (spec Section 5), English only. A legally reviewed wording should
// be confirmed before real patient use (spec Section 8); a regional-language
// version can be added later if patients need it.
const copy = {
  heading: "Before you join",
  intro:
    "This consultation will be recorded and transcribed for your medical records.",
  bullets: [
    "The audio recording is deleted after 1 day.",
    "The transcript is deleted after 3 months.",
    "Nothing is kept longer than this.",
  ],
  agree: "I agree to the above.",
  improve:
    "I allow anonymised content (with my name and details removed) to be used to improve the service.",
  join: "Join Consultation",
};

// Consent is the patient's action, so this is always the patient view: no
// transcript, and the patient's name labels their video tile.
export default function ConsentGate({
  id,
  name,
  roomUrl,
  userName,
}: {
  id: string;
  name: string;
  roomUrl: string;
  userName: string;
}) {
  const [agreed, setAgreed] = useState(false);
  const [improve, setImprove] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  if (joined)
    return (
      <CallFrame
        id={id}
        name={name}
        roomUrl={roomUrl}
        showTranscript={false}
        userName={userName}
        role="patient"
      />
    );

  function join() {
    setError("");
    startTransition(async () => {
      const result = await recordConsent(id, improve);
      if (result.ok) setJoined(true);
      else setError(result.error ?? "Something went wrong.");
    });
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="card flex w-full max-w-lg flex-col gap-5 p-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {copy.heading}
          </h1>
        </div>

        <div className="flex flex-col gap-2 text-sm text-slate-700">
          <p>{copy.intro}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {copy.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>

        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 accent-teal-600"
          />
          <span>{copy.agree}</span>
        </label>

        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={improve}
            onChange={(e) => setImprove(e.target.checked)}
            className="mt-0.5 accent-teal-600"
          />
          <span>{copy.improve}</span>
        </label>

        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={join}
          disabled={!agreed || pending}
          className="btn btn-primary self-start"
        >
          {pending ? "Joining…" : copy.join}
        </button>
      </div>
    </main>
  );
}
