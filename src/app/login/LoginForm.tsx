"use client";

import { useActionState, useState } from "react";
import {
  requestOtp,
  verifyAndLogin,
  pinLogin,
  type RequestState,
  type VerifyState,
} from "./actions";

const requestInit: RequestState = { sent: false, phone: "" };
const verifyInit: VerifyState = {};
const pinInit: VerifyState = {};

const inputClass = "field";
const buttonClass = "btn btn-primary";
const linkClass = "text-sm text-slate-500 underline underline-offset-2 hover:text-slate-700";

export default function LoginForm() {
  const [mode, setMode] = useState<"otp" | "pin">("otp");

  const [reqState, requestAction, requesting] = useActionState(requestOtp, requestInit);
  const [verifyState, verifyAction, verifying] = useActionState(verifyAndLogin, verifyInit);
  const [pinState, pinAction, pinning] = useActionState(pinLogin, pinInit);

  // --- PIN sign-in -----------------------------------------------------------
  if (mode === "pin") {
    return (
      <form action={pinAction} className="flex w-full flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="pin-phone" className="label">
            Phone number
          </label>
          <input id="pin-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required className={inputClass} />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="pin" className="label">
            PIN
          </label>
          <input id="pin" name="pin" type="password" inputMode="numeric" autoComplete="current-password" required className={inputClass} />
        </div>

        {pinState.error ? (
          <p role="alert" className="text-sm text-red-600">{pinState.error}</p>
        ) : null}

        <button type="submit" disabled={pinning} className={buttonClass}>
          {pinning ? "Signing in…" : "Sign in with PIN"}
        </button>

        <button type="button" onClick={() => setMode("otp")} className={linkClass}>
          Use a one-time code instead
        </button>
      </form>
    );
  }

  // --- OTP step 2: enter the code -------------------------------------------
  if (reqState.sent) {
    return (
      <form action={verifyAction} className="flex w-full flex-col gap-4">
        <input type="hidden" name="phone" value={reqState.phone} />

        <p className="text-sm text-slate-600">
          Enter the code sent to{" "}
          <span className="font-medium text-slate-900">{reqState.phone}</span>.
        </p>

        {reqState.devCode ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Dev mode — your code is{" "}
            <span className="font-mono font-semibold">{reqState.devCode}</span>
          </p>
        ) : null}

        <div className="flex flex-col gap-1">
          <label htmlFor="code" className="label">
            Verification code
          </label>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required className={inputClass} />
        </div>

        {verifyState.error ? (
          <p role="alert" className="text-sm text-red-600">{verifyState.error}</p>
        ) : null}

        <button type="submit" disabled={verifying} className={buttonClass}>
          {verifying ? "Verifying…" : "Verify & sign in"}
        </button>
      </form>
    );
  }

  // --- OTP step 1: enter phone ----------------------------------------------
  return (
    <form action={requestAction} className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="phone" className="label">
          Phone number
        </label>
        <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={reqState.phone} required className={inputClass} />
      </div>

      {reqState.error ? (
        <p role="alert" className="text-sm text-red-600">{reqState.error}</p>
      ) : null}

      <button type="submit" disabled={requesting} className={buttonClass}>
        {requesting ? "Sending code…" : "Send code"}
      </button>

      <button type="button" onClick={() => setMode("pin")} className={linkClass}>
        Sign in with a PIN instead
      </button>
    </form>
  );
}
