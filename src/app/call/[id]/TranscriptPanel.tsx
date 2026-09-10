"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { MergedTranscription, ScribeStatus } from "@/lib/useScribeTranscription";
import { endConsultation } from "./actions";
import ReviewSummary from "./ReviewSummary";

const statusLabel: Record<ScribeStatus, string> = {
  idle: "Not started",
  connecting: "Connecting…",
  listening: "Listening",
  reconnecting: "Reconnecting…",
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
  showPatientAudio = true,
}: {
  consultationId: string;
  transcription: MergedTranscription;
  // Video calls transcribe two sources (doctor mic + patient audio) and show a
  // "patient audio connected" hint. In-clinic audio is a single room mic, so
  // that hint (and per-speaker labels) don't apply.
  showPatientAudio?: boolean;
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
  // Once the consultation is ended, the generated summary + drafted patient
  // message are shown here for the doctor to review/edit (v2 §6/§7). null = not
  // yet ended.
  const [reviewData, setReviewData] = useState<{
    summary: string;
    patientMessage: string;
  } | null>(null);
  // Whether transcription has been started at least once, so the button reads
  // "Resume" (not "Start") after a pause.
  const [hasStarted, setHasStarted] = useState(false);

  function startTranscription() {
    setHasStarted(true);
    start();
  }

  // --- Auto-save --------------------------------------------------------------
  // So a forgotten "End & save" (or a closed tab / dropped call) never loses the
  // transcript, persist a draft as it grows. This only saves the text — the
  // summary + "done" status still come from the explicit End & save below.
  const lastSavedRef = useRef("");
  const fullTextRef = useRef(fullText);
  useEffect(() => {
    fullTextRef.current = fullText;
  });

  // Debounced periodic save: after 8s of no further speech, flush the latest.
  useEffect(() => {
    if (!fullText || fullText === lastSavedRef.current) return;
    const timer = setTimeout(() => {
      const text = fullText;
      lastSavedRef.current = text;
      fetch(`/api/consultation/${consultationId}/autosave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        keepalive: true,
      }).catch(() => {
        lastSavedRef.current = ""; // let the next change retry
      });
    }, 8000);
    return () => clearTimeout(timer);
  }, [fullText, consultationId]);

  // Best-effort save when the tab is hidden/closed or this view unmounts, using
  // sendBeacon so it still goes out during page teardown.
  useEffect(() => {
    const flush = () => {
      const text = fullTextRef.current;
      if (!text || text === lastSavedRef.current) return;
      lastSavedRef.current = text;
      const blob = new Blob([JSON.stringify({ text })], {
        type: "application/json",
      });
      navigator.sendBeacon(`/api/consultation/${consultationId}/autosave`, blob);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [consultationId]);

  function endAndSave() {
    setSaveMsg("");
    if (active) stop();
    startSaving(async () => {
      const result = await endConsultation(consultationId, fullText);
      if (result.ok) {
        setReviewData({
          summary: result.summary,
          patientMessage: result.patientMessage,
        });
        if (!result.summarized && result.error) setSaveMsg(result.error);
      } else {
        setSaveMsg(result.error ?? "Could not save.");
      }
    });
  }

  return (
    <aside className="flex w-full flex-col gap-3 md:h-full md:w-96">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Live transcript</h2>
        {reviewData === null ? (
          <button
            type="button"
            onClick={active ? stop : startTranscription}
            className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
          >
            {active ? "Pause" : hasStarted ? "Resume" : "Start transcription"}
          </button>
        ) : null}
      </div>

      <p
        className={`text-xs ${
          status === "reconnecting" ? "text-amber-600" : "text-gray-400"
        }`}
      >
        {status === "stopped" && hasStarted ? "Paused" : statusLabel[status]}
        {active && showPatientAudio ? (
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
            {seg.role ? (
              <span className="font-medium text-gray-500">{seg.role}: </span>
            ) : null}
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
            {p.role ? <span className="font-medium">{p.role}: </span> : null}
            {p.text}
          </p>
        ))}
      </div>

      {reviewData === null ? (
        <>
          <button
            type="button"
            onClick={endAndSave}
            disabled={saving || committed.length === 0}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "End & save consultation"}
          </button>
          {saveMsg ? <p className="text-xs text-red-600">{saveMsg}</p> : null}
        </>
      ) : (
        <div className="border-t border-gray-200 pt-3">
          {saveMsg ? <p className="mb-2 text-xs text-amber-600">{saveMsg}</p> : null}
          <ReviewSummary
            consultationId={consultationId}
            initialSummary={reviewData.summary}
            initialPatientMessage={reviewData.patientMessage}
          />
        </div>
      )}
    </aside>
  );
}
