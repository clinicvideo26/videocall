"use client";

import {
  useScribeTranscription,
  type MergedTranscription,
  type ScribeStatus,
} from "@/lib/useScribeTranscription";
import TranscriptPanel from "@/app/call/[id]/TranscriptPanel";

const ACTIVE: ScribeStatus[] = ["connecting", "listening", "reconnecting"];

// In-clinic (audio) consultation: the doctor is in the room with the patient, so
// one local microphone captures the whole conversation. It reuses the exact same
// Scribe transcription + English translation + End&save + PDF pipeline as the
// video call — just with no video room. A single mic can't separate speakers, so
// there are no per-speaker labels; the transcript is the plain conversation.
export default function AudioConsultation({
  consultationId,
}: {
  consultationId: string;
}) {
  const single = useScribeTranscription(consultationId, { role: "" });

  // Adapt the single-session output to the shape TranscriptPanel expects.
  const transcription: MergedTranscription = {
    status: single.status,
    error: single.error,
    partials: single.partial ? [{ role: "", text: single.partial }] : [],
    committed: single.committed,
    fullText: single.committed.map((c) => c.english ?? c.source).join("\n"),
    active: ACTIVE.includes(single.status),
    patientAudioReady: false,
    start: single.start,
    stop: single.stop,
  };

  return (
    <TranscriptPanel
      consultationId={consultationId}
      transcription={transcription}
      showPatientAudio={false}
    />
  );
}
