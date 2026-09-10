"use client";

import { useState } from "react";
import Link from "next/link";
import CallFrame from "./CallFrame";
import ConsentGate from "./ConsentGate";

type Role = null | "doctor" | "patient";

// First screen on a consultation link: the person picks their role. This only
// sets who's who (names/labels + who sees the transcript) — it does NOT change
// how the transcript itself attributes speech. On the doctor's device the local
// mic is always "Doctor" (questions) and the incoming audio is "Patient"
// (answers), decided by audio source, not by this button.
export default function JoinGate({
  id,
  name,
  roomUrl,
  isDoctor,
  consentAlready,
  doctorToken,
}: {
  id: string;
  name: string;
  roomUrl: string;
  isDoctor: boolean;
  consentAlready: boolean;
  doctorToken?: string;
}) {
  const [role, setRole] = useState<Role>(null);

  if (role === "doctor") {
    // The live transcript is sensitive (spec 3.3): only a logged-in clinician
    // may see it. Choosing "Doctor" without a session is sent to staff login,
    // so a patient can't reveal the transcript just by clicking this button.
    if (!isDoctor) {
      return (
        <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-lg font-semibold text-slate-900">
            Please sign in as clinic staff
          </h1>
          <p className="max-w-sm text-sm text-slate-500">
            The doctor view (with the live transcript) requires a staff login.
            Sign in, then reopen this consultation link.
          </p>
          <Link href="/login" className="btn btn-primary">
            Go to staff login
          </Link>
          <button
            type="button"
            onClick={() => setRole(null)}
            className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-700"
          >
            Back
          </button>
        </main>
      );
    }
    return (
      <CallFrame
        id={id}
        name={name}
        roomUrl={roomUrl}
        showTranscript
        userName="Doctor"
        role="doctor"
        token={doctorToken}
      />
    );
  }

  if (role === "patient") {
    // Consent is the patient's action; if already given, straight into video.
    if (consentAlready) {
      return (
        <CallFrame
          id={id}
          name={name}
          roomUrl={roomUrl}
          showTranscript={false}
          userName={name}
          role="patient"
        />
      );
    }
    return <ConsentGate id={id} name={name} roomUrl={roomUrl} userName={name} />;
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="card flex w-full max-w-md flex-col gap-5 p-6 text-center">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Join consultation
          </h1>
          <p className="mt-1 text-sm text-slate-500">{name}</p>
        </div>
        <p className="text-sm text-slate-600">Who are you joining as?</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => setRole("doctor")}
            className="btn btn-primary flex-1 py-3"
          >
            Join as Doctor
          </button>
          <button
            type="button"
            onClick={() => setRole("patient")}
            className="btn btn-secondary flex-1 py-3"
          >
            Join as Patient
          </button>
        </div>
        <p className="text-xs text-slate-400">
          The doctor sees the live transcript; the patient sees only the video.
        </p>
      </div>
    </main>
  );
}
