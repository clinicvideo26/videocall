"use client";

import { useState, useTransition } from "react";
import { approveConsultation } from "./actions";

// Doctor reviews and edits the AI-generated summary before it's finalised and
// sent (v2 §6). Used both inline after End & save and on the standalone review
// page. Approving persists the edited summary, marks the consultation done, and
// sends the PDF to the clinic.
export default function ReviewSummary({
  consultationId,
  initialSummary,
}: {
  consultationId: string;
  initialSummary: string;
}) {
  const [summary, setSummary] = useState(initialSummary);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);

  function approve() {
    setMsg("");
    start(async () => {
      const r = await approveConsultation(consultationId, summary);
      if (!r.ok) {
        setMsg(r.error ?? "Could not approve.");
        return;
      }
      setDone(true);
      const bits = ["Approved and saved."];
      if (r.whatsapp === "sent") {
        bits.push("PDF sent to the clinic's WhatsApp.");
      } else if (r.whatsapp === "failed") {
        bits.push("WhatsApp delivery failed — the PDF is in the Transcripts tab.");
      }
      bits.push("View it in the Transcripts tab.");
      setMsg(bits.join(" "));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Review summary</h2>
        <p className="mt-1 text-xs text-slate-500">
          Check and edit the AI-generated summary. Approving finalises the record
          and sends the PDF to the clinic.
        </p>
      </div>
      <textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        disabled={done || pending}
        rows={10}
        placeholder="No summary was generated — you can write one here."
        className="w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:bg-slate-50"
      />
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
