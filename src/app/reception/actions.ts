"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createDailyRoom } from "@/lib/daily";
import { generateConsultationId } from "@/lib/ids";
import { normalizePhone } from "@/lib/otp";

export type ReceptionCreateState =
  | { status: "idle" }
  | { status: "error"; error: string }
  | {
      status: "success";
      id: string;
      name: string;
      mode: "audio" | "video";
      link: string | null;
    };

async function shareLink(id: string): Promise<string> {
  if (process.env.APP_URL) return `${process.env.APP_URL.replace(/\/$/, "")}/call/${id}`;
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}/call/${id}`;
}

// Reception registers a patient consultation (v2 §4/§5): patient by phone,
// assigned doctor, audio or video. Never blocks on a missing name — the phone
// is the identity.
export async function createReceptionConsultation(
  _prev: ReceptionCreateState,
  formData: FormData
): Promise<ReceptionCreateState> {
  const session = await requireRole("reception", "admin");

  const patientPhone = normalizePhone(String(formData.get("patientPhone") ?? ""));
  const nameInput = String(formData.get("name") ?? "").trim();
  const doctorId = String(formData.get("doctorId") ?? "").trim();
  const mode = String(formData.get("mode") ?? "") === "audio" ? "audio" : "video";

  if (patientPhone.length < 10) {
    return { status: "error", error: "Enter a valid patient phone number." };
  }

  // Doctor must belong to this clinic (unassigned is allowed).
  let assignedDoctorId: string | null = null;
  if (doctorId) {
    const doc = await prisma.user.findFirst({
      where: { id: doctorId, clinicId: session.clinicId, role: "doctor" },
      select: { id: true },
    });
    if (!doc) return { status: "error", error: "Pick a valid doctor." };
    assignedDoctorId = doc.id;
  }

  // Patient identity = phone within clinic. Reuse an existing record; keep its
  // stored name if reception didn't type one (returning patient).
  const key = { clinicId_phone: { clinicId: session.clinicId, phone: patientPhone } };
  const existing = await prisma.patient.findUnique({ where: key });
  const name = nameInput || existing?.name || "";
  if (!existing) {
    await prisma.patient.create({
      data: { clinicId: session.clinicId, phone: patientPhone, name: name || null },
    });
  } else if (nameInput && nameInput !== existing.name) {
    await prisma.patient.update({ where: key, data: { name: nameInput } });
  }

  const id = generateConsultationId();

  // Video → Daily room + link. Audio → no room.
  let roomUrl = "";
  if (mode === "video") {
    try {
      roomUrl = (await createDailyRoom(id)).url;
    } catch (e) {
      return {
        status: "error",
        error: e instanceof Error ? e.message : "Could not create the video room.",
      };
    }
  }

  try {
    await prisma.consultation.create({
      data: {
        id,
        name: name || patientPhone,
        patientPhone,
        clinicId: session.clinicId,
        doctorId: assignedDoctorId,
        mode,
        roomUrl,
        status: "registered",
      },
    });
  } catch {
    return { status: "error", error: "Could not save the consultation. Check the database." };
  }

  revalidatePath("/reception");
  return {
    status: "success",
    id,
    name: name || patientPhone,
    mode,
    link: mode === "video" ? await shareLink(id) : null,
  };
}

// "Send in" (v2 §4): the patient has entered the room / is ready.
export async function sendIn(formData: FormData): Promise<void> {
  const session = await requireRole("reception", "admin");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.consultation.updateMany({
    where: { id, clinicId: session.clinicId, status: "registered" },
    data: { status: "in_room" },
  });
  revalidatePath("/reception");
}
