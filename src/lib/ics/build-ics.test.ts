import { describe, expect, it } from "vitest";
import { buildIcs, escapeText, type IcsInput } from "./build-ics";
import { parseIcs } from "./test-support";

const BASE: IcsInput = {
  letterId: "abc123",
  opensAt: "2026-11-02T20:00:00.000Z",
  link: "https://revenant.devclef.se/l/abc123",
  summary: "Your letter opens",
  description: "Open your Revenant letter: https://revenant.devclef.se/l/abc123",
  domain: "revenant.devclef.se",
  dtstamp: "2026-11-01T10:00:00.000Z",
};

/** Physical lines of an .ics text, without the trailing CRLF. */
function physicalLines(text: string): string[] {
  return text.slice(0, -2).split("\r\n");
}

describe("buildIcs output", () => {
  it("matches the exact calendar text for a fixed letter", () => {
    const expected = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Revenant//Live demo//EN",
      "BEGIN:VEVENT",
      "UID:abc123@revenant.devclef.se",
      "DTSTAMP:20261101T100000Z",
      "DTSTART:20261102T200000Z",
      "DTEND:20261102T201500Z",
      "SUMMARY:Your letter opens",
      "DESCRIPTION:Open your Revenant letter: https://revenant.devclef.se/l/abc123",
      "URL:https://revenant.devclef.se/l/abc123",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:Your letter opens",
      "TRIGGER:PT0S",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ];
    expect(buildIcs(BASE)).toBe(`${expected.join("\r\n")}\r\n`);
  });

  it("uses CRLF only and ends with CRLF", () => {
    const out = buildIcs(BASE);
    expect(out.endsWith("\r\n")).toBe(true);
    expect(out.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });

  it("adds the link to the description when the caller left it out", () => {
    const parsed = parseIcs(buildIcs({ ...BASE, description: "Your letter is ready." }));
    expect(parsed.description).toBe(`Your letter is ready.\n${BASE.link}`);
  });

  it("states the event as a 15-minute event from the opening time", () => {
    const parsed = parseIcs(buildIcs(BASE));
    expect(parsed.opensAt).toBe("2026-11-02T20:00:00.000Z");
    expect(parsed.endsAt).toBe("2026-11-02T20:15:00.000Z");
    expect(parsed.uid).toBe("abc123@revenant.devclef.se");
    expect(parsed.url).toBe(BASE.link);
    expect(parsed.prodid).toBe("-//Revenant//Live demo//EN");
  });

  it("carries a display alarm that fires at the start", () => {
    const parsed = parseIcs(buildIcs(BASE));
    expect(parsed.alarm).toEqual({
      action: "DISPLAY",
      trigger: "PT0S",
      description: BASE.summary,
    });
  });

  it("rejects an opening time or stamp that is not a date", () => {
    expect(() => buildIcs({ ...BASE, opensAt: "not a date" })).toThrow(RangeError);
    expect(() => buildIcs({ ...BASE, dtstamp: "" })).toThrow(RangeError);
  });
});

describe("escapeText", () => {
  it("escapes backslash, semicolon, comma and newline", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });

  it("escapes a backslash before n so it is not read as a newline", () => {
    expect(escapeText("\\n")).toBe("\\\\n");
  });
});

describe("escaping in the file", () => {
  it("escapes special characters in SUMMARY and reads them back", () => {
    const summary = "Pick: a, b; c\\d\nend";
    const out = buildIcs({ ...BASE, summary });
    expect(physicalLines(out)).toContain("SUMMARY:Pick: a\\, b\\; c\\\\d\\nend");
    expect(parseIcs(out).summary).toBe(summary);
  });

  it("turns CRLF and lone CR into a single escaped newline", () => {
    const out = buildIcs({ ...BASE, summary: "one\r\ntwo\rthree" });
    expect(physicalLines(out)).toContain("SUMMARY:one\\ntwo\\nthree");
    expect(parseIcs(out).summary).toBe("one\ntwo\nthree");
  });
});

describe("folding", () => {
  it("leaves a line of exactly 75 octets on one physical line", () => {
    // "SUMMARY:" is 8 octets, so 67 more makes 75.
    const out = buildIcs({ ...BASE, summary: "x".repeat(67) });
    expect(physicalLines(out)).toContain(`SUMMARY:${"x".repeat(67)}`);
  });

  it("folds a 76-octet line after 75 octets with CRLF and one space", () => {
    const out = buildIcs({ ...BASE, summary: "x".repeat(68) });
    const lines = physicalLines(out);
    expect(lines).toContain(`SUMMARY:${"x".repeat(67)}`);
    expect(lines).toContain(" x");
  });

  it("does not split a two-byte character across lines", () => {
    // "é" is 2 octets. The first line holds 33 of them (8 + 66 = 74 octets);
    // a 34th would need 76 octets. Each continuation holds 74 octets of content
    // plus its leading space, so the remaining 7 fit on one continuation line.
    const out = buildIcs({ ...BASE, summary: "é".repeat(40) });
    const lines = physicalLines(out);
    expect(lines).toContain(`SUMMARY:${"é".repeat(33)}`);
    expect(lines).toContain(` ${"é".repeat(7)}`);
    expect(parseIcs(out).summary).toBe("é".repeat(40));
  });

  it("keeps a four-byte emoji whole when folding", () => {
    // Each emoji is 4 octets. 8 + 4 * 16 = 72 fits; the 17th would need 76.
    const summary = "😀".repeat(20);
    const out = buildIcs({ ...BASE, summary });
    const lines = physicalLines(out);
    expect(lines[lines.findIndex((l) => l.startsWith("SUMMARY:"))]).toBe(
      `SUMMARY:${"😀".repeat(16)}`,
    );
    expect(parseIcs(out).summary).toBe(summary);
  });
});

describe("content", () => {
  it("holds only the strings passed in and the fixed property names", () => {
    const parsed = parseIcs(buildIcs(BASE));
    expect(new Set(parsed.names)).toEqual(
      new Set([
        "PRODID",
        "VERSION",
        "UID",
        "DTSTAMP",
        "DTSTART",
        "DTEND",
        "SUMMARY",
        "DESCRIPTION",
        "URL",
        "ACTION",
        "TRIGGER",
      ]),
    );
  });
});
