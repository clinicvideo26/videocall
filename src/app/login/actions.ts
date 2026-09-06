"use server";

import { redirect } from "next/navigation";
import { createSession, verifyPassword } from "@/lib/auth";

export type LoginState = { error: string };

export async function login(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  // Always run both checks so a wrong username and wrong password take the
  // same amount of work (avoids trivial username enumeration by timing).
  const userOk = !!process.env.CLINIC_LOGIN_USER && username === process.env.CLINIC_LOGIN_USER;
  const passOk = verifyPassword(password, process.env.CLINIC_LOGIN_PASSWORD_HASH);

  if (!userOk || !passOk) {
    return { error: "Invalid username or password." };
  }

  await createSession(username);
  redirect("/dashboard");
}
