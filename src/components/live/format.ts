// Display formatting for the Seal_Page and sealed view. Display only: nothing
// here decides whether a letter is open. Pure module: no I/O.

const LOCAL_DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZoneName: "short",
});

/**
 * Formats a UTC ISO time in the reader's local time zone, for example
 * "30 October 2026, 12:00 CET". Returns "" when the input is not a date.
 */
export function formatLocalDateTime(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  return LOCAL_DATE_TIME.format(new Date(ms));
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

/**
 * Formats a number of seconds as plain words, for example "1 minute 5
 * seconds". Fractions are dropped and negative values read as zero.
 */
export function formatRemaining(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(plural(hours, "hour"));
  if (minutes > 0) parts.push(plural(minutes, "minute"));
  if (secs > 0 || parts.length === 0) parts.push(plural(secs, "second"));
  return parts.join(" ");
}
