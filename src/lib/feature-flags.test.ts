import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The real `server-only` package throws unless bundled for a server runtime.
// Tests run in Node, so replace it with an empty module.
vi.mock("server-only", () => ({}));

import { realSealingOn } from "./feature-flags";

describe("realSealingOn", () => {
  const original = process.env.REAL_SEALING;

  beforeEach(() => {
    delete process.env.REAL_SEALING;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.REAL_SEALING;
    } else {
      process.env.REAL_SEALING = original;
    }
  });

  // Property 27: real sealing is off unless the setting is exactly "on".
  it("is on only when the trimmed setting is exactly \"on\" (Property 27)", () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        process.env.REAL_SEALING = value;
        expect(realSealingOn()).toBe(value.trim() === "on");
      }),
    );
  });

  it("is off when the setting is unset", () => {
    expect(realSealingOn()).toBe(false);
  });

  it("is on when the setting is \"on\"", () => {
    process.env.REAL_SEALING = "on";
    expect(realSealingOn()).toBe(true);
  });

  it("is off when the setting is \"off\"", () => {
    process.env.REAL_SEALING = "off";
    expect(realSealingOn()).toBe(false);
  });

  it("is on when the setting is \" on \" with surrounding spaces", () => {
    process.env.REAL_SEALING = " on ";
    expect(realSealingOn()).toBe(true);
  });

  it.each(["ON", "true", "1", ""])("is off for %j", (value) => {
    process.env.REAL_SEALING = value;
    expect(realSealingOn()).toBe(false);
  });
});
