// Test-only parser for the .ics file. Imported only by *.test.ts files.
// It is not exported from src/lib/ics/index.ts.
//
// It checks the file shape the way a calendar app would: every physical line
// ends in CRLF (no bare LF or CR), continuation lines start with a space, and
// the BEGIN/END pairs nest. Then it unfolds and unescapes the values.

export interface ParsedIcs {
  /** Every property name in file order, for example "SUMMARY" or "TRIGGER". */
  names: string[];
  prodid: string;
  uid: string;
  dtstamp: string;
  /** DTSTART as an ISO 8601 UTC string, for example "2026-11-02T20:00:00.000Z". */
  opensAt: string;
  /** DTEND as an ISO 8601 UTC string. */
  endsAt: string;
  summary: string;
  description: string;
  url: string;
  alarm: { action: string; trigger: string; description: string };
}

const BASIC_UTC = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/;

export function parseIcs(text: string): ParsedIcs {
  if (/\r(?!\n)|(?<!\r)\n/.test(text)) {
    throw new Error("parseIcs: line endings must be CRLF only");
  }
  if (!text.endsWith("\r\n")) {
    throw new Error("parseIcs: file must end with CRLF");
  }

  const physical = text.slice(0, -2).split("\r\n");
  const logical: string[] = [];
  for (const line of physical) {
    if (line.startsWith(" ")) {
      if (logical.length === 0) throw new Error("parseIcs: continuation with no line before it");
      logical[logical.length - 1] += line.slice(1);
    } else {
      logical.push(line);
    }
  }

  const names: string[] = [];
  const props: Array<{ depth: string; name: string; value: string }> = [];
  const stack: string[] = [];
  let depth = "";

  for (const line of logical) {
    const colon = line.indexOf(":");
    if (colon < 0) throw new Error(`parseIcs: line has no value: ${line}`);
    const rawName = line.slice(0, colon).split(";")[0];
    const value = line.slice(colon + 1);

    if (rawName === "BEGIN") {
      stack.push(depth);
      depth = value;
      continue;
    }
    if (rawName === "END") {
      if (value !== depth) throw new Error(`parseIcs: END:${value} does not match ${depth}`);
      depth = stack.pop() ?? "";
      continue;
    }
    names.push(rawName);
    props.push({ depth, name: rawName, value });
  }

  if (stack.length !== 0 || depth !== "") {
    throw new Error("parseIcs: BEGIN and END do not balance");
  }

  const get = (scope: string, name: string): string => {
    const found = props.find((p) => p.depth === scope && p.name === name);
    if (!found) throw new Error(`parseIcs: missing ${name} in ${scope}`);
    return unescapeText(found.value);
  };
  const alarmDescription = props.find((p) => p.depth === "VALARM" && p.name === "DESCRIPTION");

  return {
    names,
    prodid: get("VCALENDAR", "PRODID"),
    uid: get("VEVENT", "UID"),
    dtstamp: basicToIso(get("VEVENT", "DTSTAMP")),
    opensAt: basicToIso(get("VEVENT", "DTSTART")),
    endsAt: basicToIso(get("VEVENT", "DTEND")),
    summary: get("VEVENT", "SUMMARY"),
    description: get("VEVENT", "DESCRIPTION"),
    url: get("VEVENT", "URL"),
    alarm: {
      action: get("VALARM", "ACTION"),
      trigger: get("VALARM", "TRIGGER"),
      description: alarmDescription ? unescapeText(alarmDescription.value) : "",
    },
  };
}

/** Reverses TEXT escaping. Unknown escapes are left as written. */
function unescapeText(value: string): string {
  return value.replace(/\\([\\;,nN])/g, (_match, char: string) =>
    char === "n" || char === "N" ? "\n" : char,
  );
}

function basicToIso(value: string): string {
  const match = BASIC_UTC.exec(value);
  if (!match) throw new Error(`parseIcs: not a UTC basic date-time: ${value}`);
  const [, y, mo, d, h, mi, s] = match;
  return `${y}-${mo}-${d}T${h}:${mi}:${s}.000Z`;
}
