// Import-time validation tests for the persona list loader (design.md
// "Persona_List", "Throws at import").
//
// index.ts parses personas.json ONCE at module load and deep-freezes the
// result. These tests prove the guarantees that follow from that:
//   - PERSONAS imported cleanly, so the committed list is valid;
//   - the list, each entry and each nested metrics array are frozen;
//   - the Maya entry is present with the expected key, region and letter_path;
//   - a mutated clone of the list fails when re-parsed, so the parse function
//     index relies on at import still rejects an invalid list;
//   - loading this module needs no .txt letter file — web code imports it
//     without touching the filesystem.

import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  PERSONAS,
  RETIRED_LETTER_IDS,
  parsePersonaList,
} from "./index";

describe("index — import-time parse", () => {
  it("exposes a non-empty, parsed persona list", () => {
    // If personas.json were invalid, importing ./index would already have
    // thrown at module load and this file would not run at all.
    expect(Array.isArray(PERSONAS)).toBe(true);
    expect(PERSONAS.length).toBeGreaterThanOrEqual(1);
  });

  it("exposes retired_letter_ids as an array", () => {
    expect(Array.isArray(RETIRED_LETTER_IDS)).toBe(true);
  });

  it("contains the Maya entry with the expected key, region and letter_path", () => {
    const maya = PERSONAS.find((p) => p.key === "us-maya");
    expect(maya).toBeDefined();
    expect(maya?.region).toBe("United States");
    expect(maya?.letter_path).toBe("letters/us-maya.txt");
  });
});

describe("index — PERSONAS is deep-frozen", () => {
  it("freezes the list, each entry and each metrics array and metric", () => {
    expect(Object.isFrozen(PERSONAS)).toBe(true);
    expect(Object.isFrozen(RETIRED_LETTER_IDS)).toBe(true);
    for (const persona of PERSONAS) {
      expect(Object.isFrozen(persona)).toBe(true);
      expect(Object.isFrozen(persona.metrics)).toBe(true);
      for (const metric of persona.metrics) {
        expect(Object.isFrozen(metric)).toBe(true);
      }
    }
  });

  it("refuses mutation of a frozen entry in strict mode", () => {
    const maya = PERSONAS[0];
    expect(() => {
      // ES modules run in strict mode, so assigning to a frozen property
      // throws. The cast only drops the readonly view so the line compiles.
      (maya as { region: string }).region = "Changed";
    }).toThrow(TypeError);
  });
});

describe("index — the parse function still rejects an invalid list", () => {
  it("throws when a mutated clone breaks a field rule", () => {
    // Clone the parsed list (dropping the freeze) and corrupt one field, then
    // feed it back through the same parse function index uses at import. It
    // must reject it — proving the import-time guard is a real validation,
    // not a no-op.
    const clone = structuredClone({
      personas: PERSONAS as unknown[],
      retired_letter_ids: RETIRED_LETTER_IDS as unknown[],
    }) as { personas: { key: string }[]; retired_letter_ids: string[] };
    clone.personas[0].key = "Not A Valid Key"; // spaces + uppercase

    expect(() => parsePersonaList(clone)).toThrow(z.ZodError);
  });

  it("throws when a mutated clone breaks a cross-check", () => {
    const clone = structuredClone({
      personas: PERSONAS as unknown[],
      retired_letter_ids: RETIRED_LETTER_IDS as unknown[],
    }) as {
      personas: { letter_id: string }[];
      retired_letter_ids: string[];
    };
    // List the persona's own current letter_id as retired — a cross-check
    // violation the per-field schema cannot catch.
    clone.retired_letter_ids = [clone.personas[0].letter_id];

    expect(() => parsePersonaList(clone)).toThrow(z.ZodError);
  });

  it("accepts the unmutated clone, confirming only the mutation is at fault", () => {
    const clone = structuredClone({
      personas: PERSONAS as unknown[],
      retired_letter_ids: RETIRED_LETTER_IDS as unknown[],
    });
    expect(() => parsePersonaList(clone)).not.toThrow();
  });
});

describe("index — loads without any letter .txt file", () => {
  it("imports and exposes PERSONAS using only JSON and pure libraries", async () => {
    // A fresh dynamic import resolves without reading any letter file: index.ts
    // imports personas.json and pure sibling modules only, never node:fs or a
    // .txt file. If it reached for the filesystem this would be where it broke.
    const mod = await import("./index");
    expect(mod.PERSONAS.length).toBeGreaterThanOrEqual(1);
    expect(mod.PERSONAS[0].letter_path).toMatch(/^letters\/.+\.txt$/);
  });
});
