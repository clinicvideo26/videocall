"use client";

import { useState, useTransition } from "react";
import { useScribeTranscription, type ScribeStatus } from "@/lib/useScribeTranscription";
import { finalizeConsultation } from "./actions";

const statusLabel: Record<ScribeStatus, string> = {
  idle: "Not started",
  connecting: "Connecting…",
  listening: "Listening",
  stopped: "Stopped",
  error: "Error",
};

// Doctor-facing live transcript. The doctor watches this but does not edit it
// (spec 3.3); if something is wrong they ask the patient to repeat.
export default function TranscriptPanel({
  consultationId,
}: {
  consultationId: string;
}) {
  const { status, error, partial, committed, fullText, start, stop } =
    useScribeTranscription(consultationId);

  const [saving, startSaving] = useTransition();
  const [saveMsg, setSaveMsg] = useState("");
  const [saved, setSaved] = useState(false);

  const active = status === "connecting" || status === "listening";

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
    <aside className="flex h-full w-full flex-col gap-3 md:w-96">
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

      <p className="text-xs text-gray-400">{statusLabel[status]}</p>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <div className="min-h-40 flex-1 overflow-y-auto rounded-md border border-gray-200 p-3 text-sm leading-relaxed">
        {committed.length === 0 && !partial ? (
          <p className="text-gray-400">Transcript will appear here as people speak…</p>
        ) : null}
        {committed.map((seg) =>
          seg.english ? (
            <span key={seg.id}>{seg.english} </span>
          ) : (
            // non-English segment still being translated
            <span key={seg.id} className="italic text-gray-400">
              {seg.source}{" "}
            </span>
          )
        )}
        {partial ? <span className="text-gray-400">{partial}</span> : null}
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

      <p className="text-[11px] leading-snug text-gray-400">
        Note: this currently transcribes only this device&apos;s microphone.
        Transcribing both participants needs the custom call (Step 6b).
      </p>
    </aside>
  );
}
