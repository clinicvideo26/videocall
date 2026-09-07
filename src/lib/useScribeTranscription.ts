"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Client for ElevenLabs Scribe v2 Realtime speech-to-text.
// Protocol verified against:
//   https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime
// The browser connects with a short-lived single-use token (minted by our
// server at /api/transcription/token) so the API key is never exposed.
//
// NOTE: this captures the LOCAL microphone. Transcribing both participants
// (doctor + patient) requires the mixed/remote audio track, which needs the
// call to move off the Daily iframe onto a @daily-co/daily-js custom call
// (Step 6b). The pipeline below is source-agnostic apart from that.
//
// Must match the host the single-use token was minted against (our token
// endpoint uses the default api.elevenlabs.io). For DPDP data-residency,
// revisit in the security pass: mint the token AND connect on the same
// residency host (e.g. api.in.residency.elevenlabs.io).

const WS_BASE = "wss://api.elevenlabs.io/v1/speech-to-text/realtime";

// Reconnect tuning for unexpected WebSocket drops (e.g. code 1006 on long
// calls). The audio pipeline stays alive; only the socket is re-opened with a
// fresh single-use token.
const MAX_RECONNECTS = 6;
const MAX_QUEUE = 400; // ~50s of 128ms audio chunks buffered during a gap

// `source` is the spoken-language text from Scribe; `english` is the (possibly
// translated) text shown and stored. For English speech english === source; for
// other languages english is filled in asynchronously by the translate call.
// `role` labels the speaker (e.g. "Doctor" / "Patient") and `at` is the commit
// time, used to interleave segments from two concurrent Scribe sessions.
export type TranscriptSegment = {
  id: number;
  role: string;
  at: number;
  source: string;
  english: string | null;
};
export type ScribeStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "reconnecting"
  | "stopped"
  | "error";

function floatTo16BitPcmBase64(input: Float32Array): string {
  const pcm = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(pcm.buffer);
  let binary = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// `role` labels this session's speaker. `getStream` supplies the audio source:
// when provided it returns a MediaStream (e.g. a remote Daily participant's
// audio track) to transcribe; when omitted the hook captures the local mic via
// getUserMedia (the original single-device behaviour, unchanged).
export type ScribeOptions = {
  role?: string;
  getStream?: () => MediaStream | null | Promise<MediaStream | null>;
};

export function useScribeTranscription(
  consultationId: string,
  opts: ScribeOptions = {}
) {
  const { role = "Doctor", getStream } = opts;
  const [status, setStatus] = useState<ScribeStatus>("idle");
  const [error, setError] = useState("");
  const [partial, setPartial] = useState("");
  const [committed, setCommitted] = useState<TranscriptSegment[]>([]);

  // Keep the latest getStream in a ref so start() stays a stable callback.
  const getStreamRef = useRef(getStream);
  useEffect(() => {
    getStreamRef.current = getStream;
  });

  const wsRef = useRef<WebSocket | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nodeRef = useRef<AudioWorkletNode | null>(null);
  const queueRef = useRef<string[]>([]); // audio captured before the socket opens
  const segId = useRef(0);
  // True only when we created the stream (getUserMedia). A borrowed stream from
  // the Daily call must NOT have its tracks stopped here — that would cut the
  // call's audio for everyone.
  const ownsStreamRef = useRef(false);
  // Auto-reconnect bookkeeping for unexpected socket drops.
  const manualStopRef = useRef(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const stop = useCallback(() => {
    manualStopRef.current = true;
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
    if (nodeRef.current) {
      nodeRef.current.port.onmessage = null;
      nodeRef.current.disconnect();
    }
    if (ownsStreamRef.current) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    }
    ctxRef.current?.close().catch(() => {});
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) {
      wsRef.current.close();
    }
    nodeRef.current = null;
    ctxRef.current = null;
    streamRef.current = null;
    wsRef.current = null;
    queueRef.current = [];
    setPartial("");
    setStatus((prev) => (prev === "error" ? prev : "stopped"));
  }, []);

  // Translate one committed segment to English via our server, then patch it
  // into place by id (order preserved even if calls resolve out of order).
  const translateSegment = useCallback(
    async (id: number, source: string) => {
      let english = source;
      try {
        const res = await fetch("/api/transcription/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ consultationId, text: source }),
        });
        const data = (await res.json().catch(() => ({}))) as { english?: string };
        if (res.ok && data.english?.trim()) english = data.english.trim();
      } catch {
        // keep source as a fallback
      }
      setCommitted((prev) => prev.map((s) => (s.id === id ? { ...s, english } : s)));
    },
    [consultationId]
  );

  const start = useCallback(async () => {
    setError("");
    manualStopRef.current = false;
    reconnectAttemptsRef.current = 0;
    setStatus("connecting");
    try {
      // Audio source → 16 kHz capture on an AudioWorklet (a dedicated audio
      // thread), so UI re-renders can't starve it and drop audio. The pipeline
      // stays alive across socket reconnects — only the WebSocket is recreated,
      // so a dropped connection (e.g. code 1006 on a long call) resumes without
      // losing the mic/track capture. The source is either a borrowed stream
      // (the remote Daily participant's audio) or the local mic.
      let stream: MediaStream | null;
      if (getStreamRef.current) {
        stream = await getStreamRef.current();
        ownsStreamRef.current = false;
        if (!stream || stream.getAudioTracks().length === 0) {
          throw new Error(`No ${role} audio available yet.`);
        }
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        ownsStreamRef.current = true;
      }
      streamRef.current = stream;
      const ctx = new AudioContext({ sampleRate: 16000 });
      ctxRef.current = ctx;
      await ctx.audioWorklet.addModule("/pcm-worklet.js");
      await ctx.resume().catch(() => {});
      const source = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, "pcm-worklet");
      nodeRef.current = node;
      queueRef.current = [];

      const sendChunk = (b64: string) => {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              message_type: "input_audio_chunk",
              audio_base_64: b64,
              commit: false,
              sample_rate: 16000,
            })
          );
        } else {
          // Socket not open (initial connect or a reconnect gap) — buffer, but
          // cap so a long outage can't grow memory without bound.
          queueRef.current.push(b64);
          if (queueRef.current.length > MAX_QUEUE) queueRef.current.shift();
        }
      };

      node.port.onmessage = (e: MessageEvent) => {
        sendChunk(floatTo16BitPcmBase64(e.data as Float32Array));
      };
      // The worklet emits no audio, so wiring it to the destination keeps it
      // pulled by the graph while staying silent (no echo).
      source.connect(node);
      node.connect(ctx.destination);

      // Reconnect scheduler; declared before openSocket so onclose can call it.
      let scheduleReconnect: (code: number) => void = () => {};

      const openSocket = async (): Promise<void> => {
        // Each connection needs a fresh single-use token.
        const res = await fetch("/api/transcription/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ consultationId }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || `Token request failed (${res.status}).`);
        }
        const { token } = (await res.json()) as { token: string };

        // Realtime WebSocket (VAD auto-commits segments on silence).
        const url =
          `${WS_BASE}?model_id=scribe_v2_realtime` +
          `&audio_format=pcm_16000&commit_strategy=vad` +
          `&include_language_detection=true` +
          `&token=${encodeURIComponent(token)}`;
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          reconnectAttemptsRef.current = 0;
          setStatus("listening");
          const queued = queueRef.current;
          queueRef.current = [];
          for (const b64 of queued) sendChunk(b64); // flush buffered audio
        };

        ws.onmessage = (evt) => {
          let msg: {
            message_type?: string;
            text?: string;
            error?: string;
            language_code?: string;
          };
          try {
            msg = JSON.parse(evt.data);
          } catch {
            return;
          }
          switch (msg.message_type) {
            case "partial_transcript":
              setPartial(msg.text ?? "");
              break;
            case "committed_transcript":
            case "committed_transcript_with_timestamps": {
              setPartial("");
              const src = msg.text?.trim();
              if (!src) break;
              const id = segId.current++;
              const lang = (msg.language_code ?? "").toLowerCase();
              const isEnglish = lang.startsWith("en");
              // English shows immediately (free); other languages show once
              // translated (english stays null until then).
              setCommitted((prev) => [
                ...prev,
                { id, role, at: Date.now(), source: src, english: isEnglish ? src : null },
              ]);
              if (!isEnglish) translateSegment(id, src);
              break;
            }
            case "error":
              setError(msg.error ?? "Transcription error.");
              break;
          }
        };

        ws.onerror = () => {
          // A close event follows; reconnection is handled in onclose.
        };

        ws.onclose = (ev) => {
          if (manualStopRef.current) return; // user pressed Stop
          if (ev.code === 1000) {
            setStatus((prev) => (prev === "listening" ? "stopped" : prev));
            return;
          }
          scheduleReconnect(ev.code); // unexpected drop (e.g. 1006) → retry
        };
      };

      scheduleReconnect = (code: number) => {
        if (manualStopRef.current) return;
        if (reconnectAttemptsRef.current >= MAX_RECONNECTS) {
          setError(
            `Transcription connection lost (code ${code}). Press Stop, then Start to resume.`
          );
          setStatus("error");
          return;
        }
        const attempt = reconnectAttemptsRef.current++;
        const delay = Math.min(500 * 2 ** attempt, 8000);
        setStatus("reconnecting");
        if (reconnectTimerRef.current !== null) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = window.setTimeout(() => {
          if (manualStopRef.current) return;
          // If reopening throws before a socket exists (e.g. the token fetch
          // fails), there is no close event to retry us — reschedule here.
          openSocket().catch(() => scheduleReconnect(code));
        }, delay);
      };

      await openSocket(); // initial connection; a failure here → outer catch
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start transcription.");
      setStatus("error");
      stop();
    }
  }, [consultationId, role, stop, translateSegment]);

  // English text shown/stored: english when available, else the source (so a
  // failed/pending translation still preserves the words).
  const fullText = committed.map((c) => c.english ?? c.source).join(" ");
  return { status, error, partial, committed, fullText, start, stop };
}

export type Partial = { role: string; text: string };
export type MergedTranscription = {
  status: ScribeStatus;
  error: string;
  partials: Partial[];
  committed: TranscriptSegment[];
  fullText: string;
  active: boolean;
  patientAudioReady: boolean;
  start: () => void;
  stop: () => void;
};

// Runs two Scribe sessions on the doctor's device — the local mic ("Doctor")
// and the remote participant's audio track ("Patient") — and merges them into a
// single speaker-labeled, time-ordered transcript (Step 6b Stage 2). The Doctor
// session is the original local-mic path, unchanged; the Patient session reads
// the borrowed Daily audio stream and only runs once that track exists.
export function useMergedTranscription(
  consultationId: string,
  opts: { getRemoteStream: () => MediaStream | null; patientAudioReady: boolean }
): MergedTranscription {
  const { getRemoteStream, patientAudioReady } = opts;

  const doctor = useScribeTranscription(consultationId, { role: "Doctor" });
  const patient = useScribeTranscription(consultationId, {
    role: "Patient",
    getStream: getRemoteStream,
  });

  const runningRef = useRef(false);
  const patientStart = patient.start;
  const patientStatus = patient.status;

  const start = useCallback(() => {
    runningRef.current = true;
    doctor.start();
    if (patientAudioReady) patient.start();
  }, [doctor, patient, patientAudioReady]);

  const stop = useCallback(() => {
    runningRef.current = false;
    doctor.stop();
    patient.stop();
  }, [doctor, patient]);

  // If the patient joins (or their audio appears) after the doctor has already
  // started transcription, bring the Patient session up too. runningRef gates
  // this so a normal stop() doesn't immediately restart it.
  useEffect(() => {
    if (
      runningRef.current &&
      patientAudioReady &&
      (patientStatus === "idle" || patientStatus === "stopped")
    ) {
      patientStart();
    }
  }, [patientAudioReady, patientStatus, patientStart]);

  const committed = useMemo(
    () =>
      [...doctor.committed, ...patient.committed].sort((a, b) => a.at - b.at),
    [doctor.committed, patient.committed]
  );

  const fullText = committed
    .map((c) => `${c.role}: ${c.english ?? c.source}`)
    .join("\n");

  const partials: Partial[] = [
    { role: "Doctor", text: doctor.partial },
    { role: "Patient", text: patient.partial },
  ].filter((p) => p.text);

  const activeStates: ScribeStatus[] = ["connecting", "listening", "reconnecting"];
  const active =
    activeStates.includes(doctor.status) || activeStates.includes(patient.status);

  // Surface the most informative combined status for the header line.
  const s = [doctor.status, patient.status];
  const status: ScribeStatus = s.includes("connecting")
    ? "connecting"
    : s.includes("reconnecting")
    ? "reconnecting"
    : s.includes("listening")
    ? "listening"
    : s.includes("error")
    ? "error"
    : s.includes("stopped")
    ? "stopped"
    : "idle";

  const error = doctor.error || patient.error;

  return {
    status,
    error,
    partials,
    committed,
    fullText,
    active,
    patientAudioReady,
    start,
    stop,
  };
}
