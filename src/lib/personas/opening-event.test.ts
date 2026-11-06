// Schema tests for the optional opening_event on a persona.
//
// A persona may name the public event its opening date comes from. The event
// is stored as a plain date with its official source. These tests cover the
// rules the schema enforces for that object.

import { describe, expect, it } from "vitest";

import { parsePersonaList } from "./schema";

// Two distinct, valid 22-char base64url letter IDs (16 bytes each).
const ID_A = "wom_GdH6gqP6AGgnyhIMgA";

const validOpeningEvent = {
  name: "European Parliament election",
  date: "2024-06-09",
  source: "European Parliament",
  source_url: "https://www.europarl.europa.eu/elections/en/",
};

/** A persona list with one persona, optionally carrying an opening_event. */
function listWith(openingEvent?: unknown): unknown {
  const persona: Record<string, unknown> = {
    key: "eu-test",
    display_name: "Test",
    region: "European Union",
    letter_id: ID_A,
    written_as_of: "2024-05-12",
    opens_at: "2024-06-09T00:00:00.000Z",
    metrics: [
      {
        metric_id: "us-gasoline-regular",
        recall_subject: "a gallon of regular gasoline",
      },
    ],
    letter_path: "letters/eu-test.txt",
  };
  if (openingEvent !== undefined) {
    persona.opening_event = openingEvent;
  }
  return { personas: [persona], retired_letter_ids: [] };
}

describe("persona opening_event", () => {
  it("accepts a valid opening_event", () => {
    expect(() =>
      parsePersonaList(listWith(structuredClone(validOpeningEvent))),
    ).not.toThrow();
  });

  it("keeps the parsed opening_event fields", () => {
    const parsed = parsePersonaList(
      listWith(structuredClone(validOpeningEvent)),
    );
    expect(parsed.personas[0].opening_event).toEqual(validOpeningEvent);
  });

  it("rejects a source other than the literal European Parliament", () => {
    const event = { ...validOpeningEvent, source: "Eurostat" };
    expect(() => parsePersonaList(listWith(event))).toThrow();
  });

  it("rejects a non-https source_url", () => {
    const event = {
      ...validOpeningEvent,
      source_url: "http://www.europarl.europa.eu/elections/en/",
    };
    expect(() => parsePersonaList(listWith(event))).toThrow();
  });

  it("rejects an opening_event with an unknown extra field", () => {
    const event = { ...validOpeningEvent, extra: "nope" };
    expect(() => parsePersonaList(listWith(event))).toThrow();
  });

  it("rejects a date that is not a real calendar date", () => {
    const event = { ...validOpeningEvent, date: "2024-02-30" };
    expect(() => parsePersonaList(listWith(event))).toThrow();
  });

  it("still parses a persona without opening_event", () => {
    const parsed = parsePersonaList(listWith());
    expect(parsed.personas[0].key).toBe("eu-test");
    expect(parsed.personas[0].opening_event).toBeUndefined();
  });
});
