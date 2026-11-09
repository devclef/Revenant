// Tests for drawSampleSeed (spec 10 C5.4, C5.6). The Web Crypto call is mocked
// with vi.stubGlobal, so no real randomness is needed and the test is exact.

import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { drawSampleSeed } from "./sample-seed";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("drawSampleSeed", () => {
  it("draws one Uint32 from crypto.getRandomValues and returns it", () => {
    const getRandomValues = vi.fn((array: Uint32Array) => {
      array[0] = 0xdeadbeef;
      return array;
    });
    vi.stubGlobal("crypto", { getRandomValues });

    expect(drawSampleSeed()).toBe(0xdeadbeef);
    expect(getRandomValues).toHaveBeenCalledTimes(1);
    const [array] = getRandomValues.mock.calls[0] as unknown as [Uint32Array];
    expect(array).toBeInstanceOf(Uint32Array);
    expect(array.length).toBe(1);
  });

  it("draws a fresh value on each call", () => {
    let next = 1;
    vi.stubGlobal("crypto", {
      getRandomValues: (array: Uint32Array) => {
        array[0] = next;
        next += 1;
        return array;
      },
    });

    expect(drawSampleSeed()).toBe(1);
    expect(drawSampleSeed()).toBe(2);
  });

  it("throws when crypto has no getRandomValues, and never uses Math.random", () => {
    vi.stubGlobal("crypto", {});
    const random = vi.spyOn(Math, "random");

    expect(() => drawSampleSeed()).toThrow(/getRandomValues/);
    expect(random).not.toHaveBeenCalled();
  });

  it("throws when crypto itself is missing, and never uses Math.random", () => {
    vi.stubGlobal("crypto", undefined);
    const random = vi.spyOn(Math, "random");

    expect(() => drawSampleSeed()).toThrow(/getRandomValues/);
    expect(random).not.toHaveBeenCalled();
  });
});

describe("source scan: the seed never comes from Math.random or the clock", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const sources = ["sample-seed.ts", "sample-pick.ts"];

  it.each(sources)("%s calls neither Math.random nor Date.now", (name) => {
    const text = readFileSync(join(here, name), "utf8");
    expect(text).not.toMatch(/Math\.random\s*\(/);
    expect(text).not.toMatch(/Date\.now\s*\(/);
  });
});
