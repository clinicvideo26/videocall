"use strict";

// Background worker: opens the side panel on icon click, and — even when the
// panel is closed — polls the doctor's queue on a 1-minute alarm and fires a
// desktop notification (with sound + a Join button) the moment an appointment
// crosses its 5-minutes-before mark, so the doctor is alerted at call time.

const DEFAULT_API_BASE = "https://videocall-84v7.onrender.com";
const POLL_ALARM = "poll-appointments";

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((e) => console.warn("sidePanel setPanelBehavior failed", e));

chrome.runtime.onInstalled.addListener(ensureAlarm);
chrome.runtime.onStartup.addListener(ensureAlarm);
function ensureAlarm() {
  chrome.alarms.create(POLL_ALARM, { periodInMinutes: 1 });
  poll();
}
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === POLL_ALARM) poll();
});

function getStore() {
  return new Promise((res) =>
    chrome.storage.local.get(
      ["token", "apiBase", "notifiedIds", "joinMap"],
      (v) => res(v || {})
    )
  );
}
function setStore(obj) {
  return new Promise((res) => chrome.storage.local.set(obj, res));
}

async function poll() {
  const store = await getStore();
  if (!store.token) return; // not signed in
  const base = (store.apiBase || DEFAULT_API_BASE).replace(/\/$/, "");

  let data;
  try {
    const res = await fetch(base + "/api/doctor/appointments", {
      headers: { Authorization: `Bearer ${store.token}` },
    });
    if (!res.ok) return; // 401 etc — panel handles re-auth
    data = await res.json();
  } catch {
    return; // offline / server asleep
  }

  const appts = data.appointments || [];
  const notified = new Set(store.notifiedIds || []);
  const joinMap = {};

  for (const a of appts) {
    joinMap[a.id] = a.joinUrl || null;
    if (!notified.has(a.id)) {
      notified.add(a.id);
      notify(a);
    }
  }

  // Prune to the currently-due set so the store stays small (and a genuinely
  // new appointment later still alerts).
  const currentIds = appts.map((a) => a.id);
  await setStore({
    notifiedIds: currentIds.filter((id) => notified.has(id)),
    joinMap,
  });
}

function notify(a) {
  const opts = {
    type: "basic",
    iconUrl: "icon128.png",
    title: `${a.name} — ${a.mode === "audio" ? "in-clinic" : "video"} consultation`,
    message:
      (a.scheduledLabel ? a.scheduledLabel + " · " : "") +
      "Patient is ready.",
    priority: 2,
    requireInteraction: true, // stay until the doctor acts
  };
  if (a.joinUrl) opts.buttons = [{ title: "Join video call" }];
  chrome.notifications.create("appt:" + a.id, opts);
}

// Clicking the notification or its Join button opens the call.
chrome.notifications.onClicked.addListener(openFor);
chrome.notifications.onButtonClicked.addListener(openFor);
async function openFor(notificationId) {
  const id = notificationId.replace(/^appt:/, "");
  const { joinMap } = await getStore();
  const url = joinMap && joinMap[id];
  if (url) chrome.tabs.create({ url });
  chrome.notifications.clear(notificationId);
}
