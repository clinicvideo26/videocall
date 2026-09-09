# Clinic Doctor — Queue (browser extension)

The doctor's side-panel widget. Signs in with phone + one-time code (or PIN),
then shows the doctor's appointments **only from 5 minutes before** their
scheduled time. Tap **Video** to open the patient's call in a new tab (the call
page shows the live transcript).

It's a plain Manifest V3 extension — no build step.

## Load it (Chrome / Edge, unpacked)

1. Go to `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick this `extension/` folder.
4. Click the extension's toolbar icon — the side panel opens.

## Sign in

- Enter your **doctor** phone number → **Send code**.
- On the live site the code shows in the panel only while `OTP_DEV_MODE=true`
  is set on the server (until real SMS/WhatsApp delivery exists). Otherwise use
  **Use a PIN instead** with a PIN you set on the web app.
- Only numbers registered as a **doctor** by the clinic admin can sign in.

## Server URL

Defaults to `https://videocall-84v7.onrender.com`. To test against a local dev
server, open the panel → **⚙ Settings** → set `http://localhost:3000` → Save.

## What it talks to

- `POST /api/doctor/otp` — request a login code
- `POST /api/doctor/login` — phone + code (or PIN) → Bearer token
- `GET /api/doctor/appointments` — the token's due appointments (polled ~30s)

The token is stored in `chrome.storage.local`; **Sign out** clears it.
