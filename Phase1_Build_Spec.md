# Phase 1 Build Specification
## Clinic Pre-Consultation Video + Transcript Tool

This document is the build plan for **Phase 1**. Hand it to Claude Code (or a developer) to build from. It lists the chosen stack, the components, the build order, and the environment variables needed.

---

## 1. What Phase 1 Does

A clinic tool where a **doctor and patient join a video link, talk, and the system produces a transcript + summary as a PDF**, delivered to the clinic's WhatsApp and available on a dashboard for a short window. The AI does **not** talk during the call — it is a silent transcriber.

**Not in Phase 1:** no booking, no scheduling, no payment, no AI agent asking questions (that is Phase 2).

---

## 2. Chosen Stack (finalized)

| Layer | Tool | Notes |
|-------|------|-------|
| Web app (dashboard + call pages) | **Next.js (React)** | Hosted on Vercel free tier |
| Video calling | **Daily.co** | Free tier ~10,000 participant-min/month |
| Live transcription | **ElevenLabs Scribe v2 Realtime** | Streaming, strong on Indian mixed-language |
| Summary | **Claude API** (Haiku-class, cheapest current small model) | Check current model list at build time |
| PDF generation | **In-house, free library** | HTML→PDF (e.g. Puppeteer / Playwright) — no external service |
| WhatsApp delivery | **Meta WhatsApp Cloud API** | Existing registered number |
| Database + storage | **Postgres + object storage** | e.g. Supabase (free tier) or Vercel Postgres + blob |
| Auto-delete | **Scheduled job (cron)** | Vercel Cron or a daily task |

> IMPORTANT for the builder: model names/versions and API details change. Before writing the Claude summary call, check the current model list at https://docs.claude.com/en/api/overview and pick the cheapest current small ("Haiku-class") model. Do the same for Daily, ElevenLabs, and Meta Cloud API — read their current docs rather than assuming.

---

## 3. Components to Build

### 3.1 Clinic dashboard (behind a login)
- **Clinic login** — one shared staff account is acceptable to start (store hashed password; do not hardcode).
- **Tab 1 — New Consultation:** input for a name → button "Create" → backend generates a unique ID + a Daily room + link → display the shareable link and the ID.
- **Tab 2 — Transcripts:** list of consultations (name, ID, date/time, status) → click to view the PDF (summary + full transcript) → Delete button per row.

### 3.2 Consultation creation (backend)
On "Create":
1. Generate a **long, random, hard-to-guess ID** (not sequential).
2. Call Daily API to **create a room** → get room URL.
3. Save a record: `{ id, name, roomUrl, createdAt, status: 'waiting', consent: null }`.
4. Return a link the clinic shares. Prefer a **branded wrapper** route (`/call/{id}`) that loads the Daily room inside your own page.

### 3.3 Call page (`/call/{id}`) — no login
1. **Consent screen first** (see Section 5). Join button disabled until required box ticked.
2. On agree → store consent timestamp + optional-box value on the record → enter the Daily room.
3. Two participants (doctor + patient), browser-based, camera/mic permission prompt (standard).
4. **Audio track** streamed to ElevenLabs Scribe v2 Realtime → **live transcript displayed to the doctor** as text appears.
5. Doctor sees the transcript but does **not** edit it; asks patient to repeat if wrong.

### 3.4 After the call
1. Finalize the transcript text.
2. Call **Claude API** to generate a **summary** from the transcript.
3. Generate a **PDF** (in-house, HTML→PDF) named `Name_ID_Date.pdf`, containing:
   - Header: patient name, ID, date/time.
   - **Summary** section.
   - **Full transcript** section.
4. Store the PDF (object storage) + link it to the record.
5. Send to the clinic via **Meta WhatsApp Cloud API** (approved template + PDF as a document message).

### 3.5 Retention / auto-delete (scheduled job, runs daily)
- **Audio:** delete after **1 day**.
- **PDF + transcript:** delete after **3 days**.
- **Manual delete** button removes a record + its files immediately.
- Job checks each item's `createdAt` against its window and deletes what's past it.

---

## 4. Data Model (minimum)

```
Consultation {
  id            (string, random, PK)
  name          (string)            // patient/reference name
  roomUrl       (string)            // Daily room
  createdAt     (timestamp)
  status        (waiting|active|done)
  consentAt     (timestamp|null)
  consentImprove(boolean)           // optional box ticked?
  transcript    (text|null)
  summary       (text|null)
  pdfPath       (string|null)
  audioPath     (string|null)       // deleted after 1 day
}
```

Audio and PDF are stored in object storage; only paths live in the DB.

---

## 5. Consent Screen (required, shown before joining)

Show in the clinic's main regional language + English. Store timestamp + optional-box value.

> **Before you join**
>
> This consultation will be recorded and transcribed for your medical records.
> - The audio recording is deleted after 1 day.
> - The transcript is deleted after 3 days.
> - Nothing is kept longer than this.
>
> ☐ I agree to the above. *(required — Join disabled until ticked)*
>
> ☐ I allow anonymised content (with my name and details removed) to be used to improve the service. *(optional)*
>
> **[ Join Consultation ]**

---

## 6. Environment Variables Needed

```
# App
APP_URL=
CLINIC_LOGIN_USER=
CLINIC_LOGIN_PASSWORD_HASH=

# Daily
DAILY_API_KEY=

# ElevenLabs
ELEVENLABS_API_KEY=

# Claude (summary)
ANTHROPIC_API_KEY=

# Meta WhatsApp Cloud API
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_TEMPLATE_NAME=
CLINIC_WHATSAPP_NUMBER=

# Database / storage
DATABASE_URL=
STORAGE_BUCKET=
```

Never hardcode keys. Never commit `.env`.

---

## 7. Suggested Build Order

1. **Scaffold** the Next.js app + deploy an empty version to Vercel (confirm hosting works).
2. **Database** setup (schema above).
3. **Clinic login** + empty dashboard with the two tabs.
4. **New Consultation** → Daily room creation → link generation (test a call joins).
5. **Consent screen** on the call page.
6. **Live transcription** (ElevenLabs Realtime) shown to the doctor.
7. **After-call pipeline:** summary (Claude) → PDF (HTML→PDF) → store.
8. **WhatsApp send** (Meta Cloud API + approved template).
9. **Transcripts tab** (view PDF, manual delete).
10. **Auto-delete cron** (audio 1 day, PDF 3 days).
11. **Security pass:** encryption at rest + in transit, access controls (see compliance checklist).

Build and test each step before moving on. Use real Indian-language sample audio to validate transcription quality early (step 6).

---

## 8. Before Real Patients (compliance)

Do not go live with real patient data until the **DPDP Compliance Checklist** items are addressed: encryption + access controls, written clinic (Processor/Fiduciary) agreement, patient-rights handling, withdrawable consent, complete consent notice, breach process — and a review by an Indian lawyer experienced in DPDP + health data.

*This spec is a technical plan, not legal advice.*

---

## 9. Roadmap Context

- **Phase 1 (this doc):** silent transcription → summary → PDF.
- **Phase 2A (later):** AI agent asks the fixed 10–20 questions, records answers.
- **Phase 2B (later):** AI agent asks constrained, answer-dependent follow-ups — built from the anonymised "answer → follow-up" dataset (Bucket 2), within doctor-defined bounds. Requires separate legal/regulatory review.

To enable Phase 2 later, keep the **optional improvement consent** in place from day one and (when ready) extract **anonymised** patterns before the 3-day deletion.
