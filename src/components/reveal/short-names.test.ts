import { describe, expect, it } from "vitest";
import { CATALOGUE } from "@/lib/figures";
import { SHORT_NAME_TABLE, shortNameFor } from "./short-names";

const DIRECTION_WORDS = [
  "up",
  "down",
  "rise",
  "rises",
  "rose",
  "risen",
  "fall",
  "falls",
  "fell",
  "fallen",
  "higher",
  "lower",
  "increase",
  "increased",
  "decrease",
  "decreased",
  "drop",
  "dropped",
  "gain",
  "gained",
  "cheaper",
  "dearer",
  "more",
  "less",
];

describe("short names (P5.4, P5.5, P5.7)", () => {
  it("names each catalogue metric_id", () => {
    expect(shortNameFor("us-gasoline-regular", "x")).toBe("Regular gasoline");
    expect(shortNameFor("us-diesel", "x")).toBe("Diesel");
    expect(shortNameFor("eu-petrol-euro95", "x")).toBe("Unleaded petrol");
    expect(shortNameFor("eu-diesel", "x")).toBe("Diesel");
  });

  it("every key is a real Catalogue metric id (checked in the test only)", () => {
    const catalogueIds = new Set(CATALOGUE.map((series) => series.metric.id));
    for (const key of SHORT_NAME_TABLE.keys()) {
      expect(catalogueIds.has(key)).toBe(true);
    }
  });

  it("covers exactly the four catalogue metric_ids", () => {
    expect([...SHORT_NAME_TABLE.keys()].sort()).toEqual([
      "eu-diesel",
      "eu-petrol-euro95",
      "us-diesel",
      "us-gasoline-regular",
    ]);
  });

  it("keeps every name at most 40 characters", () => {
    for (const name of SHORT_NAME_TABLE.values()) {
      expect(name.length).toBeLessThanOrEqual(40);
    }
  });

  it("uses no direction word in any name", () => {
    for (const name of SHORT_NAME_TABLE.values()) {
      const words = name.toLowerCase().split(/[^a-z]+/);
      for (const word of DIRECTION_WORDS) {
        expect(words).not.toContain(word);
      }
    }
  });

  it("falls back to the sealed display_name for an unknown metric_id", () => {
    const sealed = "Heating oil, retail price";
    expect(shortNameFor("no-such-series", sealed)).toBe(sealed);
  });
});
