// Fetch status rules (spec 08-judge-polish, task 2; R20.18). A succeeded series
// gets the run start time; a failed series keeps its earlier entry. Values are
// clearly fake test strings, not real run times.

import { describe, expect, it } from "vitest";

import { parseFetchStatus, updateFetchStatus } from "./prefetch";

const GASOLINE = "us-gasoline-regular";
const DIESEL = "us-diesel";
const EU_PETROL = "eu-petrol-euro95";
const EU_DIESEL = "eu-diesel";
const RUN = "2026-11-01T12:00:00Z";
const OLD = "2026-10-25T12:00:00Z";

describe("updateFetchStatus", () => {
  it("writes the run start for each succeeded series", () => {
    const text = updateFetchStatus({}, [GASOLINE, DIESEL], RUN);
    expect(JSON.parse(text)).toEqual({ [GASOLINE]: RUN, [DIESEL]: RUN });
  });

  it("keeps the earlier entry of a series that failed", () => {
    const text = updateFetchStatus(
      { [GASOLINE]: OLD, [DIESEL]: OLD },
      [DIESEL],
      RUN,
    );
    expect(JSON.parse(text)).toEqual({ [GASOLINE]: OLD, [DIESEL]: RUN });
  });

  it("orders keys in catalogue order and ends with a newline", () => {
    const text = updateFetchStatus({}, [EU_DIESEL, GASOLINE, EU_PETROL], RUN);
    expect(Object.keys(JSON.parse(text))).toEqual([
      GASOLINE,
      EU_PETROL,
      EU_DIESEL,
    ]);
    expect(text.endsWith("}\n")).toBe(true);
    expect(text).toContain('  "us-gasoline-regular"');
  });

  it("is a no-op when every series failed", () => {
    const existing = { [GASOLINE]: OLD };
    expect(JSON.parse(updateFetchStatus(existing, [], RUN))).toEqual(existing);
  });
});

describe("parseFetchStatus", () => {
  it("accepts an object of strings", () => {
    expect(parseFetchStatus({ [GASOLINE]: RUN })).toEqual({ [GASOLINE]: RUN });
  });

  it("rejects a non-object and a non-string value", () => {
    expect(() => parseFetchStatus([])).toThrow(/not an object/);
    expect(() => parseFetchStatus(null)).toThrow(/not an object/);
    expect(() => parseFetchStatus({ [GASOLINE]: 3 })).toThrow(/not a string/);
  });
});
