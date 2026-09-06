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

export type TranscriptSegment = { id: number; text: string };
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
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const segId = useRef(0);

  const stop = useCallback(() => {
    nodeRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    ctxRef.current?.close().catch(() => {});
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) {
      wsRef.current.close();
    }
    nodeRef.current = null;
    ctxRef.current = null;
    streamRef.current = null;
    wsRef.current = null;
    setPartial("");
    setStatus((prev) => (prev === "error" ? prev : "stopped"));
  }, []);

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

      // 2. Microphone at 16 kHz (AudioContext resamples from the device rate).
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const ctx = new AudioContext({ sampleRate: 16000 });
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      nodeRef.current = processor;
      // Sink through a muted gain node so the processor runs without echoing.
      const mute = ctx.createGain();
      mute.gain.value = 0;

      // 3. Realtime WebSocket (VAD auto-commits segments on silence).
      const url =
        `${WS_BASE}?model_id=scribe_v2_realtime` +
        `&audio_format=pcm_16000&commit_strategy=vad` +
        `&token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      let chunksSent = 0;

      ws.onopen = async () => {
        console.log("[scribe] websocket open; ctx.state=", ctx.state);
        await ctx.resume().catch(() => {});
        setStatus("listening");
        source.connect(processor);
        processor.connect(mute);
        mute.connect(ctx.destination);
        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          ws.send(
            JSON.stringify({
              message_type: "input_audio_chunk",
              audio_base_64: floatTo16BitPcmBase64(e.inputBuffer.getChannelData(0)),
              commit: false,
              sample_rate: 16000,
            })
          );
          chunksSent++;
          if (chunksSent === 1 || chunksSent % 25 === 0) {
            console.log("[scribe] audio chunks sent:", chunksSent);
          }
        };
      };

      ws.onmessage = (evt) => {
        let msg: { message_type?: string; text?: string; error?: string };
        try {
          msg = JSON.parse(evt.data);
        } catch {
          console.warn("[scribe] non-JSON message:", evt.data);
          return;
        }
        console.log("[scribe] <-", msg.message_type, msg.text ?? msg.error ?? "");
        switch (msg.message_type) {
          case "partial_transcript":
            setPartial(msg.text ?? "");
            break;
          case "committed_transcript":
          case "committed_transcript_with_timestamps":
            if (msg.text) {
              setCommitted((prev) => [...prev, { id: segId.current++, text: msg.text! }]);
            }
            setPartial("");
            break;
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
  }, [consultationId, stop]);

  const fullText = committed.map((c) => c.text).join(" ");
  return { status, error, partial, committed, fullText, start, stop };
}
