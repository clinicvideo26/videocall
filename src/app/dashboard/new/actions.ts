"use server";

import { headers } from "next/headers";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createDailyRoom } from "@/lib/daily";
import { generateConsultationId } from "@/lib/ids";

export type CreateState =
  | { status: "idle" }
  | { status: "error"; error: string }
  | { status: "success"; id: string; name: string; link: string };

async function shareLink(id: string): Promise<string> {
  // Prefer an explicit APP_URL; otherwise derive from the request host.
  if (process.env.APP_URL) return `${process.env.APP_URL.replace(/\/$/, "")}/call/${id}`;
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}/call/${id}`;
}

export async function createConsultation(
  _prev: CreateState,
  formData: FormData
): Promise<CreateState> {
  await requireSession();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { status: "error", error: "Please enter a name." };

  const id = generateConsultationId();

  // 1. Create the Daily room (room name = the consultation ID).
  let roomUrl: string;
  try {
    const room = await createDailyRoom(id);
    roomUrl = room.url;
  } catch (e) {
    return {
      status: "error",
      error: e instanceof Error ? e.message : "Could not create the video room.",
    };
  }

  // 2. Persist the record (status defaults to "waiting", consent null).
  try {
    await prisma.consultation.create({ data: { id, name, roomUrl } });
  } catch {
    return {
      status: "error",
      error: "The video room was created but saving the record failed. Check the database.",
    };
  }

  // 3. Return the branded, shareable link.
  return { status: "success", id, name, link: await shareLink(id) };
}
