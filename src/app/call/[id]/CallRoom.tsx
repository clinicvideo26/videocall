"use client";

import { useEffect, useRef, useState } from "react";
import DailyIframe, { type DailyCall } from "@daily-co/daily-js";

type Tile = {
  sessionId: string;
  label: string;
  isLocal: boolean;
  stream: MediaStream;
};

type CallStatus = "joining" | "joined" | "left" | "error";

function VideoTile({ tile }: { tile: Tile }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== tile.stream) {
      ref.current.srcObject = tile.stream;
    }
  });
  return (
    <div className="relative aspect-video overflow-hidden rounded-md bg-black">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={tile.isLocal}
        className="h-full w-full object-cover"
      />
      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
        {tile.label}
      </span>
    </div>
  );
}

// Custom Daily call (replaces the prebuilt iframe) so the doctor's device can
// access each participant's audio track for per-speaker transcription (Stage 2).
export default function CallRoom({ roomUrl }: { roomUrl: string }) {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [status, setStatus] = useState<CallStatus>("joining");
  const [error, setError] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const callRef = useRef<DailyCall | null>(null);
  const streams = useRef<Map<string, MediaStream>>(new Map());

  useEffect(() => {
    // In dev, StrictMode double-mounts; guard against a duplicate call object.
    if (callRef.current) return;
    const call = DailyIframe.createCallObject();
    callRef.current = call;

    const syncStream = (sessionId: string, tracks: MediaStreamTrack[]) => {
      let s = streams.current.get(sessionId);
      if (!s) {
        s = new MediaStream();
        streams.current.set(sessionId, s);
      }
      const wanted = new Set(tracks.map((t) => t.id));
      for (const t of s.getTracks()) if (!wanted.has(t.id)) s.removeTrack(t);
      const have = new Set(s.getTracks().map((t) => t.id));
      for (const t of tracks) if (!have.has(t.id)) s.addTrack(t);
      return s;
    };

    const rebuild = () => {
      const participants = call.participants();
      const next: Tile[] = [];
      for (const p of Object.values(participants)) {
        const tracks: MediaStreamTrack[] = [];
        const v = p.tracks?.video?.persistentTrack;
        const a = p.tracks?.audio?.persistentTrack;
        if (v) tracks.push(v);
        if (a) tracks.push(a);
        next.push({
          sessionId: p.session_id,
          label: p.local ? "You (doctor)" : p.user_name || "Patient",
          isLocal: !!p.local,
          stream: syncStream(p.session_id, tracks),
        });
      }
      // drop streams for participants who left
      const live = new Set(next.map((t) => t.sessionId));
      for (const key of streams.current.keys()) {
        if (!live.has(key)) streams.current.delete(key);
      }
      setTiles(next);
    };

    call.on("joined-meeting", () => {
      setStatus("joined");
      rebuild();
    });
    call.on("participant-joined", rebuild);
    call.on("participant-updated", rebuild);
    call.on("participant-left", rebuild);
    call.on("track-started", rebuild);
    call.on("track-stopped", rebuild);
    call.on("left-meeting", () => setStatus("left"));
    call.on("error", (e) => {
      setError(e?.errorMsg ?? "Call error.");
      setStatus("error");
    });

    call.join({ url: roomUrl }).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : "Could not join the call.");
      setStatus("error");
    });

    return () => {
      call.destroy().catch(() => {});
      callRef.current = null;
      streams.current.clear();
    };
  }, [roomUrl]);

  function toggleMic() {
    const call = callRef.current;
    if (!call) return;
    const next = !micOn;
    call.setLocalAudio(next);
    setMicOn(next);
  }
  function toggleCam() {
    const call = callRef.current;
    if (!call) return;
    const next = !camOn;
    call.setLocalVideo(next);
    setCamOn(next);
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {status === "error" ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      {status === "joining" ? (
        <p className="text-sm text-gray-400">Joining the call…</p>
      ) : null}

      <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
        {tiles.map((t) => (
          <VideoTile key={t.sessionId} tile={t} />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleMic}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
        >
          {micOn ? "Mute mic" : "Unmute mic"}
        </button>
        <button
          type="button"
          onClick={toggleCam}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
        >
          {camOn ? "Turn camera off" : "Turn camera on"}
        </button>
      </div>
    </div>
  );
}
