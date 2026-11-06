// Feature: 09-demo-polish, Property 3: The now message matches the reason
// (issue #250, A3.1 to A3.4, A3.6).
//
// nowMessageFor must return the one line that matches each lookup outcome, and
// only that line. "No longer published" may appear only for a series that is
// missing from the figures response.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { REVEAL_COPY } from "./copy";
import { nowMessageFor, type NowMessageReason } from "./now-message";

const ISO_INSTANT = fc
  .integer({ min: Date.UTC(2000, 0, 1), max: Date.UTC(2035, 11, 31) })
  .map((ms) => new Date(ms).toISOString());

const REASON: fc.Arbitrary<NowMessageReason> = fc.oneof(
  fc.constant({ kind: "series_missing" } as const),
  fc.constant({ kind: "no_figure" } as const),
  fc.constant({ kind: "request_failed" } as const),
  fc.record({
    kind: fc.constant("found" as const),
    fallback: fc.boolean(),
    retrievedAt: ISO_INSTANT,
  }),
);

const FALLBACK_PREFIX = REVEAL_COPY.fallbackNote.split("{date}")[0] ?? "";

describe("nowMessageFor (Property 3, A3.1 to A3.4)", () => {
  it("returns the line that matches each reason, and no other", () => {
    fc.assert(
      fc.property(REASON, (reason) => {
        const message = nowMessageFor(reason);
        switch (reason.kind) {
          case "series_missing":
            expect(message).toBe(REVEAL_COPY.nowRetired);
            break;
          case "no_figure":
            expect(message).toBe(REVEAL_COPY.nowNotYet);
            break;
          case "request_failed":
            expect(message).toBe(REVEAL_COPY.nowUnavailableFetch);
            break;
          case "found":
            if (reason.fallback) {
              expect(message).not.toBeNull();
              expect(message?.startsWith(FALLBACK_PREFIX)).toBe(true);
            } else {
              expect(message).toBeNull();
            }
            break;
        }
      }),
      { numRuns: 200 },
    );
  });

  it("gives the fallback note the retrieved date in UTC, as '30 October 2024'", () => {
    fc.assert(
      fc.property(ISO_INSTANT, (retrievedAt) => {
        const message = nowMessageFor({
          kind: "found",
          fallback: true,
          retrievedAt,
        });
        const date = new Date(retrievedAt);
        const day = date.getUTCDate();
        const year = date.getUTCFullYear();
        expect(message).toContain(`retrieved ${day} `);
        expect(message).toContain(` ${year}.`);
        expect(message).not.toContain("{date}");
      }),
      { numRuns: 200 },
    );
  });

  it("says 'no longer publish...' only for a series that is missing", () => {
    fc.assert(
      fc.property(REASON, (reason) => {
        const message = nowMessageFor(reason) ?? "";
        const says = /no longer publish/i.test(message);
        expect(says).toBe(reason.kind === "series_missing");
      }),
      { numRuns: 200 },
    );
  });
});

const BANNED = ["today", "current", "latest", "live"] as const;

describe("Now_Figure message copy (A3.6)", () => {
  const NOW_MESSAGES = {
    nowRetired: REVEAL_COPY.nowRetired,
    nowNotYet: REVEAL_COPY.nowNotYet,
    fallbackNote: nowMessageFor({
      kind: "found",
      fallback: true,
      retrievedAt: "2026-10-30T14:02:11Z",
    }) ?? "",
  };

  for (const [key, text] of Object.entries(NOW_MESSAGES)) {
    it(`${key} avoids today, current, latest and live`, () => {
      for (const word of BANNED) {
        expect(
          new RegExp(`\\b${word}\\b`, "i").test(text),
          `${key} must not contain "${word}" -> "${text}"`,
        ).toBe(false);
      }
    });
  }

  it("the fallback note names the retrieved date", () => {
    expect(NOW_MESSAGES.fallbackNote).toBe(
      "Revenant hasn't fetched a newer figure yet. This one was retrieved 30 October 2026.",
    );
  });
});
