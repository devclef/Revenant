// Feature: 05-reveal-ceremony, issue #103
//
// The ink reveal is a registered sequence, so the shared Skip control ends it
// as well as the letter's own "Show the whole letter" control (R11.4). The
// layout effect that starts the run cannot run in a static render, so this
// checks the wiring in the source. inkSession.test.ts covers that skip() settles
// the run once and runs onSettled.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(__dirname, "InkLetter.tsx"), "utf8");

describe("InkLetter is a registered sequence", () => {
  it("reads register from useSequence", () => {
    expect(source).toMatch(/const \{ register \} = useSequence\(\);/);
  });

  it("registers a skip that settles the running ink session", () => {
    expect(source).toMatch(/unregisterRef\.current = register\(\(\) => session\.skip\(\)\);/);
  });

  it("unregisters when the run settles and when the effect is cleaned up", () => {
    const unregisters = source.match(/unregister\(\);/g) ?? [];
    expect(unregisters.length).toBeGreaterThanOrEqual(2);
  });
});
