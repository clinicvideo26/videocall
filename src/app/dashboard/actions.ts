"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { destroySession, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

// Manual delete (spec 3.5): remove a consultation record immediately. The PDF
// is generated on demand from the record, so deleting the record removes it too.
export async function deleteConsultation(formData: FormData): Promise<void> {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await prisma.consultation.delete({ where: { id } });
  } catch {
    // Already gone — nothing to do.
  }
  revalidatePath("/dashboard/transcripts");
}
