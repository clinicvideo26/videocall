"use client";

import { useCallback, useRef, useState } from "react";

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

// `source` is the spoken-language text from Scribe; `english` is the (possibly
// translated) text shown and stored. For English speech english === source; for
// other languages english is filled in asynchronously by the translate call.
export type TranscriptSegment = { id: number; source: string; english: string | null };
export type ScribeStatus =
  | "idle"
  | "connecting"
  | "listening"
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

export function useScribeTranscription(consultationId: string) {
  const [status, setStatus] = useState<ScribeStatus>("idle");
  const [error, setError] = useState("");
  const [partial, setPartial] = useState("");
  const [committed, setCommitted] = useState<TranscriptSegment[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nodeRef = useRef<AudioWorkletNode | null>(null);
  const queueRef = useRef<string[]>([]); // audio captured before the socket opens
  const segId = useRef(0);

  const stop = useCallback(() => {
    if (nodeRef.current) {
      nodeRef.current.port.onmessage = null;
      nodeRef.current.disconnect();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
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
    setStatus("connecting");
    try {
      // 1. Single-use token from our server.
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

      // 2. Microphone → 16 kHz capture on an AudioWorklet (a dedicated audio
      // thread), so UI re-renders can't starve it and drop audio. Capture
      // starts now and is buffered until the socket opens — no opening words
      // are lost.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const ctx = new AudioContext({ sampleRate: 16000 });
      ctxRef.current = ctx;
      await ctx.audioWorklet.addModule("/pcm-worklet.js");
      await ctx.resume().catch(() => {});
      const source = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, "pcm-worklet");
      nodeRef.current = node;
      queueRef.current = [];
      let chunksSent = 0;

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
          chunksSent++;
        } else {
          queueRef.current.push(b64); // socket not open yet — buffer it
        }
      };

      node.port.onmessage = (e: MessageEvent) => {
        sendChunk(floatTo16BitPcmBase64(e.data as Float32Array));
      };
      // The worklet emits no audio, so wiring it to the destination keeps it
      // pulled by the graph while staying silent (no echo).
      source.connect(node);
      node.connect(ctx.destination);

      // 3. Realtime WebSocket (VAD auto-commits segments on silence).
      const url =
        `${WS_BASE}?model_id=scribe_v2_realtime` +
        `&audio_format=pcm_16000&commit_strategy=vad` +
        `&include_language_detection=true` +
        `&token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[scribe] websocket open; ctx.state=", ctx.state);
        setStatus("listening");
        const queued = queueRef.current;
        queueRef.current = [];
        for (const b64 of queued) sendChunk(b64); // flush buffered opening audio
        console.log("[scribe] flushed buffered chunks:", queued.length);
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
          console.warn("[scribe] non-JSON message:", evt.data);
          return;
        }
        console.log("[scribe] <-", msg.message_type, msg.language_code ?? "", msg.text ?? msg.error ?? "");
        switch (msg.message_type) {
          case "partial_transcript":
            setPartial(msg.text ?? "");
            break;
          case "committed_transcript":
          case "committed_transcript_with_timestamps": {
            setPartial("");
            const source = msg.text?.trim();
            if (!source) break;
            const id = segId.current++;
            const lang = (msg.language_code ?? "").toLowerCase();
            const isEnglish = lang.startsWith("en");
            // English shows immediately (free); other languages show once
            // translated (english stays null until then).
            setCommitted((prev) => [
              ...prev,
              { id, source, english: isEnglish ? source : null },
            ]);
            if (!isEnglish) translateSegment(id, source);
            break;
          }
          case "error":
            setError(msg.error ?? "Transcription error.");
            break;
        }
      };

      ws.onerror = (ev) => {
        console.error("[scribe] websocket error", ev);
        setError("Transcription connection error.");
      };
      ws.onclose = (ev) => {
        console.warn(
          `[scribe] websocket closed code=${ev.code} reason=${ev.reason || "(none)"} chunksSent=${chunksSent}`
        );
        if (ev.code !== 1000 && ev.code !== 1005) {
          setError(
            `Connection closed (code ${ev.code}${ev.reason ? `: ${ev.reason}` : ""}).`
          );
        }
        setStatus((prev) => (prev === "listening" ? "stopped" : prev));
      };
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start transcription.");
      setStatus("error");
      stop();
    }
  }, [consultationId, stop, translateSegment]);

  // English text shown/stored: english when available, else the source (so a
  // failed/pending translation still preserves the words).
  const fullText = committed.map((c) => c.english ?? c.source).join(" ");
  return { status, error, partial, committed, fullText, start, stop };
}
