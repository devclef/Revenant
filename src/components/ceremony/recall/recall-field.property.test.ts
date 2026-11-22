import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  checkField,
  draftTextFor,
  initialField,
  isUnreadable,
  isUnreadableEntry,
  canAdvance,
  pickReading,
  resolvedValue,
  setFromScale,
  typeText,
  unreadableShown,
  type FieldState,
  type Reading,
} from "./recall-field";

// Feature: 16-remember-first, Property 9: The number message waits for a check.
// Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6
//
// The unreadable message shows only after a check (blur or Next attempt) has
// found the text unreadable, and only while every edit since that check has
// left the text unreadable. A scale move or a picked reading clears it.
// Check events never change what the judge's answer resolves to.

const NUM_RUNS = 200;

type Event =
  | { kind: "type"; text: string }
  | { kind: "blur" }
  | { kind: "attempt" }
  | { kind: "scale"; canonical: string }
  | { kind: "reading"; reading: Reading };

const textArb = fc.oneof(
  fc.constantFrom("", "4.", "12a", "12", "3.47", "1.585", "1,5", "abc", " "),
  fc.string({ maxLength: 8 }),
);

const eventArb: fc.Arbitrary<Event> = fc.oneof(
  { weight: 4, arbitrary: textArb.map((text) => ({ kind: "type", text }) as Event) },
  { weight: 2, arbitrary: fc.constant<Event>({ kind: "blur" }) },
  { weight: 2, arbitrary: fc.constant<Event>({ kind: "attempt" }) },
  {
    weight: 1,
    arbitrary: fc
      .constantFrom("3.47", "12", "0")
      .map((canonical) => ({ kind: "scale", canonical }) as Event),
  },
  {
    weight: 1,
    arbitrary: fc
      .constantFrom<Reading>("decimal", "grouping")
      .map((reading) => ({ kind: "reading", reading }) as Event),
  },
);

const sequenceArb = fc.array(eventArb, { maxLength: 20 });

/** Applies one event to a field. Blur and attempt both run the check. */
function apply(s: FieldState, ev: Event): FieldState {
  switch (ev.kind) {
    case "type":
      return typeText(s, ev.text);
    case "blur":
    case "attempt":
      return checkField(s);
    case "scale":
      return setFromScale(s, ev.canonical);
    case "reading":
      return pickReading(s, ev.reading);
  }
}

/** The outputs that must not depend on check events. */
function valuesOf(s: FieldState) {
  return {
    draft: draftTextFor(s),
    advance: canAdvance(s, false),
    resolved: resolvedValue(s),
  };
}

describe("Property 9: the number message waits for a check", () => {
  it("shows exactly when the last check found the text unreadable and no edit since then changed that", () => {
    fc.assert(
      fc.property(sequenceArb, (events) => {
        let s = initialField({ text: "", noAnswer: false });
        // Model: whether the message should show after each event.
        let shown = false;
        for (const ev of events) {
          const before = s;
          s = apply(s, ev);
          switch (ev.kind) {
            case "type":
              // Every edit must leave the text unreadable to keep the message.
              shown = shown && isUnreadable(ev.text);
              break;
            case "blur":
            case "attempt":
              shown = isUnreadableEntry(s.typed);
              break;
            case "scale":
              shown = false;
              break;
            case "reading":
              // pickReading only acts on an ambiguous parse; unreadable text
              // is never ambiguous, so a reading there changes nothing.
              if (before.parse.kind === "ambiguous") shown = false;
              break;
          }
          expect(unreadableShown(s)).toBe(shown);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("does not show the message while the judge is still typing (4. and 12a, focused)", () => {
    // 11.1: nothing shows before a check. 11.3: "4." is still being written.
    let s = initialField({ text: "", noAnswer: false });
    s = typeText(s, "4.");
    expect(unreadableShown(s)).toBe(false);
    s = typeText(s, "12a");
    expect(unreadableShown(s)).toBe(false);
  });

  it("shows the message for 12a after blur, and clears it on the next readable or empty edit", () => {
    // 11.2 and 11.4.
    let s = initialField({ text: "", noAnswer: false });
    s = typeText(s, "12a");
    s = checkField(s);
    expect(unreadableShown(s)).toBe(true);
    s = typeText(s, "12");
    expect(unreadableShown(s)).toBe(false);

    s = typeText(s, "12a");
    s = checkField(s);
    expect(unreadableShown(s)).toBe(true);
    s = typeText(s, "");
    expect(unreadableShown(s)).toBe(false);
  });

  it("removing every check event leaves the draft text, advance and resolved value unchanged", () => {
    // 11.6: check events only change what the message shows.
    fc.assert(
      fc.property(sequenceArb, (events) => {
        let full = initialField({ text: "", noAnswer: false });
        let bare = initialField({ text: "", noAnswer: false });
        for (const ev of events) {
          full = apply(full, ev);
          if (ev.kind === "blur" || ev.kind === "attempt") continue;
          bare = apply(bare, ev);
          expect(valuesOf(full)).toEqual(valuesOf(bare));
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
