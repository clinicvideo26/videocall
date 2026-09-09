// Appointment times are entered by reception in clinic-local time (IST) and
// stored as UTC. India Standard Time is a fixed +05:30 offset with no daylight
// saving, so we can convert without a timezone library.

const IST_OFFSET = "+05:30";

/**
 * Turn a browser `<input type="datetime-local">` value ("YYYY-MM-DDTHH:MM",
 * which carries no timezone) into a UTC `Date`, interpreting the wall-clock
 * time as IST. Returns null for empty/invalid input.
 */
export function istInputToDate(value: string): Date | null {
  const v = value.trim();
  if (!v) return null;
  // datetime-local may include seconds ("...:SS"); normalise to minutes.
  const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/.exec(v);
  if (!m) return null;
  const d = new Date(`${m[1]}:00${IST_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format a stored UTC `Date` as a clinic-local (IST) label for display. */
export function formatIst(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}
