"use client";

import { useEffect, useRef, useState } from "react";
import DailyIframe, { type DailyCall } from "@daily-co/daily-js";
import { useMergedTranscription } from "@/lib/useScribeTranscription";
import TranscriptPanel from "./TranscriptPanel";

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
// When `showTranscript`, the doctor also runs two Scribe sessions here — local
// mic + the remote participant's audio track — merged into one labeled feed.
export default function CallRoom({
  roomUrl,
  consultationId,
  showTranscript = false,
  userName,
  role,
  token,
}: {
  roomUrl: string;
  consultationId: string;
  showTranscript?: boolean;
  userName: string;
  role: "doctor" | "patient";
  // Owner meeting token for the doctor (private rooms). Patients have none and
  // knock instead.
  token?: string;
}) {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [status, setStatus] = useState<CallStatus>("joining");
  const [error, setError] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  // Waiting room: patients this doctor can admit (doctor side); whether we (the
  // patient) are waiting to be let in (patient side).
  const [waiting, setWaiting] = useState<{ id: string; name: string }[]>([]);
  const [lobby, setLobby] = useState(false);
  const [patientAudioReady, setPatientAudioReady] = useState(false);
  const [videoReduced, setVideoReduced] = useState(false);
  const callRef = useRef<DailyCall | null>(null);
  const sendQualityRef = useRef<"low" | "medium">("medium");
  const streams = useRef<Map<string, MediaStream>>(new Map());
  // Audio-only stream carrying the remote (patient) track, fed to the Patient
  // Scribe session. Kept separate from the tile streams so transcription owns a
  // stable handle regardless of video track churn.
  const remoteAudioRef = useRef<MediaStream | null>(null);

  const transcription = useMergedTranscription(consultationId, {
    getRemoteStream: () => remoteAudioRef.current,
    patientAudioReady,
  });

  useEffect(() => {
    // In dev, StrictMode double-mounts; guard against a duplicate call object.
    if (callRef.current) return;
    const call = DailyIframe.createCallObject();
    callRef.current = call;
    const sessionStreams = streams.current; // stable handle for cleanup

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

    // Keep remoteAudioRef holding exactly the first remote participant's audio
    // track, and flag readiness so the Patient Scribe session can (re)start.
    const syncRemoteAudio = (track: MediaStreamTrack | null) => {
      if (track) {
        let s = remoteAudioRef.current;
        if (!s) {
          s = new MediaStream();
          remoteAudioRef.current = s;
        }
        if (!s.getAudioTracks().some((t) => t.id === track.id)) {
          s.getAudioTracks().forEach((t) => s!.removeTrack(t));
          s.addTrack(track);
        }
      } else if (remoteAudioRef.current) {
        remoteAudioRef.current
          .getTracks()
          .forEach((t) => remoteAudioRef.current!.removeTrack(t));
      }
      setPatientAudioReady(!!track);
    };

    const meLabel = role === "doctor" ? "You (Doctor)" : "You (Patient)";
    const otherLabel = role === "doctor" ? "Patient" : "Doctor";

    const rebuild = () => {
      const participants = call.participants();
      const next: Tile[] = [];
      let remoteAudio: MediaStreamTrack | null = null;
      for (const p of Object.values(participants)) {
        const tracks: MediaStreamTrack[] = [];
        const v = p.tracks?.video?.persistentTrack;
        const a = p.tracks?.audio?.persistentTrack;
        if (v) tracks.push(v);
        if (a) tracks.push(a);
        if (!p.local && a && !remoteAudio) remoteAudio = a;
        next.push({
          sessionId: p.session_id,
          label: p.local ? meLabel : p.user_name || otherLabel,
          isLocal: !!p.local,
          stream: syncStream(p.session_id, tracks),
        });
      }
      // drop streams for participants who left
      const live = new Set(next.map((t) => t.sessionId));
      for (const key of streams.current.keys()) {
        if (!live.has(key)) streams.current.delete(key);
      }
      syncRemoteAudio(remoteAudio);
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

    // The doctor's device runs the 2-way video plus two Scribe pipelines, which
    // can overload weaker devices ("CPU is busy"). When Daily reports high CPU,
    // drop our outgoing video quality; restore it once the CPU recovers. Audio
    // (the transcript) is never touched.
    const applyQuality = (q: "low" | "medium") => {
      if (sendQualityRef.current === q) return;
      sendQualityRef.current = q;
      call.updateSendSettings({ video: { maxQuality: q } }).catch(() => {});
      setVideoReduced(q === "low");
    };
    call.on("cpu-load-change", (ev) => {
      applyQuality(ev?.cpuLoadState === "high" ? "low" : "medium");
    });

    // --- Waiting room (private rooms + knocking) ---------------------------
    // Patient: when we land in the lobby, knock once and show a waiting state.
    let knocked = false;
    const syncAccess = () => {
      const access = (call.accessState?.() as { access?: string } | undefined)
        ?.access;
      if (access === "lobby") {
        setLobby(true);
        if (!knocked) {
          knocked = true;
          call.requestAccess?.({ name: userName }).catch(() => {});
        }
      } else {
        setLobby(false);
      }
    };
    call.on("access-state-updated", syncAccess);

    // Doctor (owner): surface knocking patients so they can be admitted/denied.
    const syncWaiting = () => {
      const wp = (call.waitingParticipants?.() ?? {}) as Record<
        string,
        { id: string; name?: string }
      >;
      setWaiting(
        Object.values(wp).map((p) => ({ id: p.id, name: p.name || "Patient" }))
      );
    };
    call.on("waiting-participant-added", syncWaiting);
    call.on("waiting-participant-updated", syncWaiting);
    call.on("waiting-participant-removed", syncWaiting);

    call
      .join({ url: roomUrl, userName, ...(token ? { token } : {}) })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Could not join the call.");
        setStatus("error");
      });

    return () => {
      call.destroy().catch(() => {});
      callRef.current = null;
      sessionStreams.clear();
      remoteAudioRef.current = null;
    };
  }, [roomUrl, userName, role, token]);

  function admitWaiting(participantId: string, grant: boolean) {
    const call = callRef.current as
      | (DailyCall & {
          updateWaitingParticipant?: (
            id: string,
            u: { grantRequestedAccess: boolean }
          ) => Promise<unknown>;
        })
      | null;
    call
      ?.updateWaitingParticipant?.(participantId, { grantRequestedAccess: grant })
      .catch(() => {});
  }

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
    <div className="flex flex-col gap-3 md:h-full md:flex-row">
      <div className="flex flex-1 flex-col gap-3">
        {status === "error" ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}
        {status === "joining" ? (
          <p className="text-sm text-gray-400">Joining the call…</p>
        ) : null}

        {role === "doctor" && waiting.length > 0 ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
            {waiting.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between gap-2 py-1"
              >
                <span className="text-sm text-amber-900">
                  <span className="font-medium">{w.name}</span> is waiting to join
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => admitWaiting(w.id, true)}
                    className="rounded-md bg-teal-600 px-3 py-1 text-xs font-medium text-white hover:bg-teal-700"
                  >
                    Admit
                  </button>
                  <button
                    type="button"
                    onClick={() => admitWaiting(w.id, false)}
                    className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Deny
                  </button>
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {role === "patient" && lobby ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
            Waiting for the doctor to let you in…
          </div>
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
          {videoReduced ? (
            <span className="text-xs text-amber-600">
              Video quality lowered to keep the call smooth.
            </span>
          ) : null}
        </div>
      </div>

      {showTranscript ? (
        <TranscriptPanel
          consultationId={consultationId}
          transcription={transcription}
        />
      ) : null}
    </div>
  );
}
