// Plain (no "use client") component: safe to render from both the server page
// and the client-side consent gate. Just embeds the Daily room in our page.
export default function CallFrame({
  name,
  roomUrl,
}: {
  name: string;
  roomUrl: string;
}) {
  return (
    <main className="flex flex-1 flex-col">
      <header className="border-b border-gray-200 px-4 py-3">
        <h1 className="text-sm font-medium">Consultation — {name}</h1>
      </header>
      <div className="flex-1">
        <iframe
          title="Video consultation"
          src={roomUrl}
          allow="camera; microphone; fullscreen; speaker; display-capture; autoplay"
          className="h-full min-h-[70vh] w-full border-0"
        />
      </div>
    </main>
  );
}
