// Builds the calendar file for a letter's opening date (R20.4, design Part D).
// Browser-only. The file holds the letter link and fixed event text. It never
// holds letter text, figures or the backup key: the caller passes only the
// strings it wants shown in the calendar.
//
// Output follows RFC 5545: CRLF line endings, text values escaped, and lines
// folded at 75 octets (counted in UTF-8) with CRLF plus one space. Folding
// never splits a multi-byte character.

/** Length of the calendar event, from the opening time (design constant). */
export const ICS_EVENT_MINUTES = 15;

/** Trigger for the reminder alarm: fire at the start of the event. */
export const ICS_ALARM_TRIGGER = "PT0S";

const PRODID = "-//Revenant//Live demo//EN";
const MAX_LINE_OCTETS = 75;
const ENCODER = new TextEncoder();

export interface IcsInput {
  letterId: string;
  opensAt: string;
  link: string;
  summary: string;
  description: string;
  domain: string;
  dtstamp: string;
}

/** Builds the .ics text. Throws `RangeError` when `opensAt` or `dtstamp` is not a valid date. */
export function buildIcs(input: IcsInput): string {
  const opens = parseInstant(input.opensAt, "opensAt");
  const ends = new Date(opens.getTime() + ICS_EVENT_MINUTES * 60_000);
  const stamp = parseInstant(input.dtstamp, "dtstamp");

  const summary = normalizeNewlines(input.summary);
  const link = normalizeNewlines(input.link);
  const baseDescription = normalizeNewlines(input.description);
  // The description always carries the link, so the calendar entry can be followed.
  const description = baseDescription.includes(link)
    ? baseDescription
    : `${baseDescription}\n${link}`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "BEGIN:VEVENT",
    `UID:${escapeText(`${input.letterId}@${input.domain}`)}`,
    `DTSTAMP:${formatBasic(stamp)}`,
    `DTSTART:${formatBasic(opens)}`,
    `DTEND:${formatBasic(ends)}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `URL:${escapeText(link)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(summary)}`,
    `TRIGGER:${ICS_ALARM_TRIGGER}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

/** Escapes a TEXT value: backslash, semicolon, comma and newline (RFC 5545 section 3.3.11). */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Turns CRLF and lone CR into LF. Newlines are escaped as `\n`, so a raw CR or LF never reaches a line. */
function normalizeNewlines(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function parseInstant(value: string, name: string): Date {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new RangeError(`buildIcs: ${name} is not a valid date`);
  }
  return new Date(ms);
}

/** UTC basic format, for example 20261102T200000Z. Seconds precision; milliseconds are dropped. */
function formatBasic(date: Date): string {
  const pad = (n: number, width = 2): string => String(n).padStart(width, "0");
  return (
    `${pad(date.getUTCFullYear(), 4)}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

/**
 * Folds one content line at 75 octets. Continuation lines start with one space,
 * so they carry 74 octets of content. Each code point is kept whole.
 */
function foldLine(line: string): string {
  const pieces: string[] = [];
  let current = "";
  let used = 0;
  let limit = MAX_LINE_OCTETS;

  for (const char of line) {
    const size = ENCODER.encode(char).length;
    if (used + size > limit) {
      pieces.push(current);
      current = "";
      used = 0;
      limit = MAX_LINE_OCTETS - 1;
    }
    current += char;
    used += size;
  }
  pieces.push(current);

  return pieces.join("\r\n ");
}
