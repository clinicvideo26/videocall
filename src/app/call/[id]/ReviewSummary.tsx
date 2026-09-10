"use client";

import { useState, useTransition } from "react";
import { approveConsultation } from "./actions";

// Doctor reviews and edits (a) the clinical summary for the record, and (b) the
// patient message — the "how to use your medication" + follow-up instructions
// sent to the patient's WhatsApp (v2 §6/§7). Used inline after End & save and on
// the standalone review page. Approving finalises the record (PDF to the clinic)
// and sends the patient message to the patient.
export default function ReviewSummary({
  consultationId,
  initialSummary,
  initialPatientMessage,
}: {
  consultationId: string;
  initialSummary: string;
  initialPatientMessage: string;
}) {
  const [summary, setSummary] = useState(initialSummary);
  const [patientMessage, setPatientMessage] = useState(initialPatientMessage);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);

  function approve() {
    setMsg("");
    start(async () => {
      const r = await approveConsultation(consultationId, summary, patientMessage);
      if (!r.ok) {
        setMsg(r.error ?? "Could not approve.");
        return;
      }
      setDone(true);
      const bits = ["Approved and saved."];
      if (r.patientWhatsapp === "sent") {
        bits.push("Instructions sent to the patient on WhatsApp.");
      } else if (r.patientWhatsapp === "failed") {
        bits.push("Couldn't WhatsApp the patient — try again or send manually.");
      }
      if (r.whatsapp === "sent") bits.push("Record PDF sent to the clinic.");
      bits.push("View it in the Transcripts tab.");
      setMsg(bits.join(" "));
    });
  }

  const fieldClass =
    "w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:bg-slate-50";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-900">
          Clinical summary{" "}
          <span className="font-normal text-slate-400">(for the record)</span>
        </label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          disabled={done || pending}
          rows={9}
          placeholder="No summary was generated — you can write one here."
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-900">
          Patient message{" "}
          <span className="font-normal text-slate-400">
            (medications / how to use — sent to the patient)
          </span>
        </label>
        <p className="text-xs text-slate-500">
          Only this goes to the patient. Keep it simple and clear; edit or clear
          it as needed.
        </p>
        <textarea
          value={patientMessage}
          onChange={(e) => setPatientMessage(e.target.value)}
          disabled={done || pending}
          rows={6}
          placeholder="e.g. Take Tablet X once daily after food for 5 days. Come back in a week if not better."
          className={fieldClass}
        />
      </div>

      <button
        type="button"
        onClick={approve}
        disabled={pending || done}
        className="btn btn-primary w-fit"
      >
        {pending ? "Approving…" : done ? "Approved ✓" : "Approve & finalize"}
      </button>
      {msg ? (
        <p className={`text-xs ${done ? "text-teal-700" : "text-red-600"}`}>
          {msg}
        </p>
      ) : null}
    </div>
  );
}
