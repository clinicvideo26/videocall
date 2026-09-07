"use client";

import { useState, useTransition } from "react";
import type { MergedTranscription, ScribeStatus } from "@/lib/useScribeTranscription";
import { finalizeConsultation } from "./actions";

const statusLabel: Record<ScribeStatus, string> = {
  idle: "Not started",
  connecting: "Connecting…",
  listening: "Listening",
  stopped: "Stopped",
  error: "Error",
};

// Doctor-facing live transcript. Both speakers are transcribed (local mic +
// remote patient audio) and shown with speaker labels (Step 6b Stage 2). The
// doctor watches but does not edit it (spec 3.3); if something is wrong they ask
// the patient to repeat. The transcription state is owned by CallRoom (which
// holds the Daily call) and passed in here.
export default function TranscriptPanel({
  consultationId,
  transcription,
}: {
  consultationId: string;
  transcription: MergedTranscription;
}) {
  const {
    status,
    error,
    partials,
    committed,
    fullText,
    active,
    patientAudioReady,
    start,
    stop,
  } = transcription;

  const [saving, startSaving] = useTransition();
  const [saveMsg, setSaveMsg] = useState("");
  const [saved, setSaved] = useState(false);

  function endAndSave() {
    setSaveMsg("");
    if (active) stop();
    startSaving(async () => {
      const result = await finalizeConsultation(consultationId, fullText);
      if (result.ok) {
        setSaved(true);
        setSaveMsg(
          result.summarized
            ? "Saved. Summary generated — view it in the Transcripts tab."
            : result.error ?? "Transcript saved."
        );
      } else {
        setSaveMsg(result.error ?? "Could not save.");
      }
    });
  }

  return (
    <aside className="flex w-full flex-col gap-3 md:h-full md:w-96">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Live transcript</h2>
        <button
          type="button"
          onClick={active ? stop : start}
          className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
        >
          {active ? "Stop" : "Start transcription"}
        </button>
      </div>

      <p className="text-xs text-gray-400">
        {statusLabel[status]}
        {active ? (
          <span className="text-gray-400">
            {" "}
            · Patient audio {patientAudioReady ? "connected" : "waiting…"}
          </span>
        ) : null}
      </p>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <div className="min-h-40 max-h-[45vh] overflow-y-auto rounded-md border border-gray-200 p-3 text-sm leading-relaxed md:max-h-none md:flex-1">
        {committed.length === 0 && partials.length === 0 ? (
          <p className="text-gray-400">
            Transcript will appear here as people speak…
          </p>
        ) : null}
        {committed.map((seg) => (
          <p key={`${seg.role}-${seg.id}`} className="mb-1">
            <span className="font-medium text-gray-500">{seg.role}: </span>
            {seg.english ? (
              <span>{seg.english}</span>
            ) : (
              // non-English segment still being translated
              <span className="italic text-gray-400">{seg.source}</span>
            )}
          </p>
        ))}
        {partials.map((p) => (
          <p key={p.role} className="mb-1 text-gray-400">
            <span className="font-medium">{p.role}: </span>
            {p.text}
          </p>
        ))}
      </div>

      <button
        type="button"
        onClick={endAndSave}
        disabled={saving || (committed.length === 0 && !saved)}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : "End & save consultation"}
      </button>
      {saveMsg ? <p className="text-xs text-green-700">{saveMsg}</p> : null}
    </aside>
  );
}
