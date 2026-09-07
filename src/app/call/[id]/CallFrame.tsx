import TranscriptPanel from "./TranscriptPanel";
import CallRoom from "./CallRoom";

// Plain (no "use client") component: safe to render from both the server page
// and the client-side consent gate. Embeds the Daily room and shows the live
// transcript alongside it.
export default function CallFrame({
  id,
  name,
  roomUrl,
  showTranscript = false,
}: {
  id: string;
  name: string;
  roomUrl: string;
  showTranscript?: boolean;
}) {
  return (
    <main className="flex flex-1 flex-col">
      <header className="border-b border-gray-200 px-4 py-3">
        <h1 className="text-sm font-medium">Consultation — {name}</h1>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <div className="flex-1 p-4">
          <CallRoom roomUrl={roomUrl} />
        </div>
        {showTranscript ? (
          <div className="border-t border-gray-200 p-4 md:border-l md:border-t-0">
            <TranscriptPanel consultationId={id} />
          </div>
        ) : null}
      </div>
    </main>
  );
}
