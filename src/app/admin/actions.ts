"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/otp";

export type AdminActionState = { error?: string; ok?: string };

// Update the admin's own clinic (name + WhatsApp number).
export async function updateClinic(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireRole("admin");
  const name = String(formData.get("name") ?? "").trim();
  const whatsappNumber = normalizePhone(String(formData.get("whatsappNumber") ?? ""));
  if (!name) return { error: "Clinic name is required." };

  await prisma.clinic.update({
    where: { id: session.clinicId },
    data: { name, whatsappNumber },
  });
  revalidatePath("/admin");
  return { ok: "Clinic details saved." };
}

// Add a doctor or reception staff member (v2 §3: no self-registration).
export async function addStaff(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireRole("admin");
  const name = String(formData.get("name") ?? "").trim();
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const roleInput = String(formData.get("role") ?? "");
  const role = roleInput === "doctor" || roleInput === "reception" ? roleInput : null;
  const specialty = String(formData.get("specialty") ?? "").trim() || null;

  if (!name) return { error: "Name is required." };
  if (phone.length < 10) return { error: "Enter a valid phone number." };
  if (!role) return { error: "Pick a role." };

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) return { error: "That phone number is already registered." };

  await prisma.user.create({
    data: {
      clinicId: session.clinicId,
      name,
      phone,
      role,
      specialty: role === "doctor" ? specialty : null,
    },
  });
  revalidatePath("/admin");
  return { ok: `Added ${name} (${role}).` };
}

// Remove a staff member. Can't delete yourself; scoped to your own clinic.
export async function deleteStaff(formData: FormData): Promise<void> {
  const session = await requireRole("admin");
  const id = String(formData.get("id") ?? "");
  if (!id || id === session.userId) return;
  await prisma.user.deleteMany({ where: { id, clinicId: session.clinicId } });
  revalidatePath("/admin");
}
