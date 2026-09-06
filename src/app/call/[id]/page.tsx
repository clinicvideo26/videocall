import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

// Branded wrapper that loads the Daily room inside our own page (spec 3.2/3.3).
// The consent screen (Step 5) will gate joining; for now this embeds the room
// directly so a call can be tested end-to-end.
export default async function CallPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let consultation: { name: string; roomUrl: string } | null;
  try {
    consultation = await prisma.consultation.findUnique({
      where: { id },
      select: { name: true, roomUrl: true },
    });
  } catch {
    // Database unavailable — surface a clear message rather than a crash.
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <h1 className="text-lg font-medium">Consultation unavailable</h1>
        <p className="text-sm text-gray-500">
          Could not load this consultation. Please try again shortly.
        </p>
      </main>
    );
  }

  if (!consultation) notFound();

  return (
    <main className="flex flex-1 flex-col">
      <header className="border-b border-gray-200 px-4 py-3">
        <h1 className="text-sm font-medium">Consultation — {consultation.name}</h1>
      </header>
      <div className="flex-1">
        <iframe
          title="Video consultation"
          src={consultation.roomUrl}
          allow="camera; microphone; fullscreen; speaker; display-capture; autoplay"
          className="h-full min-h-[70vh] w-full border-0"
        />
      </div>
    </main>
  );
}
