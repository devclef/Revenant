// Tests for the keepsake helpers (spec 06, task 11; R20.4, R20.5, R20.6).
// The `.ics` text is checked for RFC 5545 shape and for what it leaves out.
// The download is checked with an injected fake of the browser calls, since
// this suite runs in the Node environment.

import { describe, expect, it } from "vitest";

import { LIVE_COPY } from "./copy";
import {
  buildKeepsakeIcs,
  domainOf,
  downloadTextFile,
  icsFileName,
  letterLinkText,
  type DownloadEnv,
} from "./keepsake-files";

const APP_ORIGIN = "https://revenant.devclef.se";
const LETTER_ID = "abc123DEF456ghi789jk";
const OPENS_AT = "2026-11-02T12:00:00.000Z";
const DTSTAMP = "2026-11-02T11:00:00.000Z";

const ics = (): string =>
  buildKeepsakeIcs({ letterId: LETTER_ID, appOrigin: APP_ORIGIN, opensAt: OPENS_AT, dtstamp: DTSTAMP });

describe("letterLinkText", () => {
  it("builds the link from the origin and the letter id", () => {
    expect(letterLinkText(APP_ORIGIN, LETTER_ID)).toBe(`${APP_ORIGIN}/l/${LETTER_ID}`);
  });
});

describe("domainOf", () => {
  it("returns the host of the origin", () => {
    expect(domainOf(APP_ORIGIN)).toBe("revenant.devclef.se");
  });

  it("falls back when the origin is not a URL", () => {
    expect(domainOf("")).toBe("revenant");
  });
});

describe("buildKeepsakeIcs", () => {
  it("uses CRLF line endings only", () => {
    const text = ics();
    expect(text.includes("\r\n")).toBe(true);
    expect(text.replace(/\r\n/g, "").includes("\n")).toBe(false);
  });

  it("has one VEVENT with the Revenant product id", () => {
    const text = ics();
    expect(text.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(text).toContain("PRODID:-//Revenant//Live demo//EN");
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(text.match(/END:VEVENT/g)).toHaveLength(1);
  });

  it("starts at the opening time and ends 15 minutes later, in UTC", () => {
    const text = ics();
    expect(text).toContain("DTSTART:20261102T120000Z");
    expect(text).toContain("DTEND:20261102T121500Z");
    expect(text).toContain("DTSTAMP:20261102T110000Z");
  });

  it("names the letter in the UID and carries the link in URL and DESCRIPTION", () => {
    const text = ics();
    expect(text).toContain(`UID:${LETTER_ID}@revenant.devclef.se`);
    expect(text).toContain(`URL:${APP_ORIGIN}/l/${LETTER_ID}`);
    expect(text).toContain(`${APP_ORIGIN}/l/${LETTER_ID}`);
  });

  it("uses the fixed event copy and an alarm at the start", () => {
    const text = ics();
    expect(text).toContain(`SUMMARY:${LIVE_COPY.icsSummary}`);
    expect(text).toContain("BEGIN:VALARM");
    expect(text).toContain("TRIGGER:PT0S");
  });

  it("holds no key, fragment or letter text", () => {
    const text = ics();
    expect(text).not.toContain("#k=");
    expect(text).not.toMatch(/[A-Z0-9]{4}-[A-Z0-9]{4}/);
    expect(text).not.toContain("Dear");
  });
});

describe("icsFileName", () => {
  it("keeps letters, digits and hyphens only", () => {
    expect(icsFileName("abc-123/../x")).toBe("revenant-letter-abc-123x.ics");
  });
});

describe("downloadTextFile", () => {
  it("builds the Blob, clicks a link to it, then revokes the URL, in that order", () => {
    const calls: string[] = [];
    const env: DownloadEnv = {
      makeBlob: (text, type) => {
        calls.push(`blob:${type}:${text.length}`);
        return { text, type } as unknown as Blob;
      },
      createObjectURL: () => {
        calls.push("create");
        return "blob:fake/1";
      },
      revokeObjectURL: (url) => calls.push(`revoke:${url}`),
      clickDownload: (href, filename) => calls.push(`click:${href}:${filename}`),
    };
    downloadTextFile("BEGIN:VCALENDAR", "letter.ics", "text/calendar", env);
    expect(calls).toEqual([
      "blob:text/calendar:15",
      "create",
      "click:blob:fake/1:letter.ics",
      "revoke:blob:fake/1",
    ]);
  });
});
