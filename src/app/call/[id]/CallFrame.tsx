import CallRoom from "./CallRoom";

// Plain (no "use client") component: safe to render from both the server page
// and the client-side join/consent gates. CallRoom owns the Daily call and, for
// the doctor, the live per-speaker transcript alongside it.
export default function CallFrame({
  id,
  name,
  roomUrl,
  showTranscript = false,
  userName,
  role,
}: {
  id: string;
  name: string;
  roomUrl: string;
  showTranscript?: boolean;
  userName: string;
  role: "doctor" | "patient";
}) {
  return (
    <main className="flex flex-1 flex-col">
      <header className="border-b border-gray-200 px-4 py-3">
        <h1 className="text-sm font-medium">Consultation — {name}</h1>
      </header>
      <div className="flex-1 p-4">
        <CallRoom
          roomUrl={roomUrl}
          consultationId={id}
          showTranscript={showTranscript}
          userName={userName}
          role={role}
        />
      </div>
    </main>
  );
}
