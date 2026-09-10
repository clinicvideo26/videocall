"use strict";

// Doctor-queue side panel. Talks to the clinic app's /api/doctor/* endpoints
// with a Bearer token stored in chrome.storage.local. No build step — plain JS.

const DEFAULT_API_BASE = "https://videocall-84v7.onrender.com";
const POLL_MS = 30_000;

const $ = (id) => document.getElementById(id);
const views = ["login", "queue", "settings"];

let apiBase = DEFAULT_API_BASE;
let token = null;
let mode = "otp"; // "otp" | "pin"
let otpSent = false;
let phone = "";
let pollTimer = null;

// --- storage ----------------------------------------------------------------
function load() {
  return new Promise((resolve) =>
    chrome.storage.local.get(["apiBase", "token"], (v) => resolve(v || {}))
  );
}
function save(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}

// --- view switching ---------------------------------------------------------
function show(view) {
  for (const v of views) $(v).hidden = v !== view;
  $("gear").hidden = view !== "queue";
}

// --- API --------------------------------------------------------------------
async function api(path, { method = "GET", body, auth = false } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (auth && token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(apiBase.replace(/\/$/, "") + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON error */
  }
  return { ok: res.ok, status: res.status, data };
}

// --- login ------------------------------------------------------------------
function resetLoginUi() {
  otpSent = false;
  $("codeRow").hidden = true;
  $("pinRow").hidden = mode !== "pin";
  $("devCode").hidden = true;
  $("loginErr").hidden = true;
  $("primaryBtn").textContent = mode === "pin" ? "Sign in" : "Send code";
  $("modeToggle").textContent =
    mode === "pin" ? "Use a one-time code instead" : "Use a PIN instead";
}

function loginError(msg) {
  const el = $("loginErr");
  el.textContent = msg;
  el.hidden = false;
}

async function onPrimary() {
  $("loginErr").hidden = true;
  phone = $("phone").value.trim();
  if (phone.replace(/\D/g, "").length < 10) {
    return loginError("Enter a valid phone number.");
  }

  const btn = $("primaryBtn");
  btn.disabled = true;
  try {
    if (mode === "otp" && !otpSent) {
      const { ok, data } = await api("/api/doctor/otp", {
        method: "POST",
        body: { phone },
      });
      if (!ok) return loginError(data.error || "Could not send the code.");
      otpSent = true;
      $("codeRow").hidden = false;
      if (data.devCode) {
        $("devCode").textContent = `Dev code: ${data.devCode}`;
        $("devCode").hidden = false;
      }
      btn.textContent = "Sign in";
      $("code").focus();
      return;
    }

    // Sign in (OTP code or PIN).
    const payload =
      mode === "pin"
        ? { phone, pin: $("pin").value.trim() }
        : { phone, code: $("code").value.trim() };
    const { ok, data } = await api("/api/doctor/login", {
      method: "POST",
      body: payload,
    });
    if (!ok) return loginError(data.error || "Sign in failed.");

    token = data.token;
    await save({ token });
    await enterQueue();
  } catch {
    loginError("Network error — check the server URL in settings.");
  } finally {
    btn.disabled = false;
  }
}

function toggleMode() {
  mode = mode === "otp" ? "pin" : "otp";
  resetLoginUi();
}

// --- queue ------------------------------------------------------------------
function statusBadge(status) {
  return `<span class="badge ${status}">${status.replace("_", " ")}</span>`;
}

function renderAppointments(list) {
  const ul = $("list");
  ul.innerHTML = "";
  $("empty").hidden = list.length > 0;

  for (const a of list) {
    const li = document.createElement("li");
    li.className = "item";
    li.innerHTML = `
      <div>
        <span class="item-name">${escapeHtml(a.name)}</span>
        ${a.patientPhone ? `<span class="item-phone">${escapeHtml(a.patientPhone)}</span>` : ""}
      </div>
      <div class="item-sub">
        ${a.scheduledLabel ? `<span class="time">${escapeHtml(a.scheduledLabel)}</span>` : ""}
        ${statusBadge(a.status)}
      </div>
      <div class="item-actions"></div>`;

    const actions = li.querySelector(".item-actions");
    if (a.joinUrl) {
      const btn = document.createElement("button");
      btn.className = "join";
      btn.textContent = a.mode === "audio" ? "Start" : "Video";
      btn.addEventListener("click", () => chrome.tabs.create({ url: a.joinUrl }));
      actions.appendChild(btn);
    }
    ul.appendChild(li);
  }
}

async function refreshQueue() {
  const { ok, status, data } = await api("/api/doctor/appointments", { auth: true });
  if (status === 401) {
    // Token expired/invalid — back to login.
    await signOut();
    return;
  }
  if (!ok) {
    $("queueMeta").textContent = data.error || "Could not load appointments.";
    return;
  }
  $("who").textContent = data.doctor ? `Dr ${data.doctor}` : "";
  $("queueMeta").textContent = `Updated ${new Date().toLocaleTimeString()}`;
  renderAppointments(data.appointments || []);
}

async function enterQueue() {
  show("queue");
  await refreshQueue();
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(refreshQueue, POLL_MS);
}

async function signOut() {
  token = null;
  if (pollTimer) clearInterval(pollTimer);
  await save({ token: null });
  mode = "otp";
  resetLoginUi();
  show("login");
}

// --- settings ---------------------------------------------------------------
function openSettings() {
  $("apiBase").value = apiBase;
  show("settings");
}
async function saveSettings() {
  const v = $("apiBase").value.trim() || DEFAULT_API_BASE;
  apiBase = v;
  await save({ apiBase: v });
  show(token ? "queue" : "login");
}

// --- util -------------------------------------------------------------------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// --- init -------------------------------------------------------------------
async function init() {
  const stored = await load();
  if (stored.apiBase) apiBase = stored.apiBase;
  token = stored.token || null;

  $("primaryBtn").addEventListener("click", onPrimary);
  $("modeToggle").addEventListener("click", toggleMode);
  $("signout").addEventListener("click", signOut);
  $("gear").addEventListener("click", openSettings);
  $("saveApi").addEventListener("click", saveSettings);
  $("closeSettings").addEventListener("click", () => show(token ? "queue" : "login"));

  if (token) {
    await enterQueue();
  } else {
    resetLoginUi();
    show("login");
  }
}

init();
