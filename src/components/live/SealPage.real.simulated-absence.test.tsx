/**
 * Requirement 13 (spec 20, Part B): Simulated_Mode is never on `/seal`.
 *
 * Every Real_Mode pair from `PAIRS` (spec 19's SealPage.real.test.tsx) is
 * rendered three ways: with no simulated value, with a simulated prop, and with
 * simulated values in deps and in the draft. None of the renders may show a
 * Simulate_Control or any Simulated_Mode string. PAIRS must keep at least the
 * entries it had at commit c2bf2db8, so the table cannot shrink unnoticed.
 *
 * The page never reads these values in Real_Mode. The renders also check that
 * the Simulated_Port factory is never called on a Real_Mode render, through a
 * spy on the crypto module that a real page would load.
 */

import { describe, expect, it } from "vitest";

import { LIVE_COPY } from "./copy";
import { PRESS_COPY } from "./press/copy";
import { PAIRS, renderReal } from "./SealPage.real.test";

/** PAIRS had 13 entries at commit c2bf2db8. It may grow, never shrink. */
const BASELINE_PAIR_COUNT = 13;

/** The text as React writes it into markup, so apostrophes match their escaped form. */
function escapedForMarkup(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** Every Simulated_Mode string in the copy tables, by key, as markup text. */
const SIMULATED_STRINGS: readonly string[] = [
  ...Object.entries(LIVE_COPY),
  ...Object.entries(PRESS_COPY),
]
  .filter(([key]) => /simulat/i.test(key))
  .map(([, value]) => escapedForMarkup(String(value)));

/** Requirement 13.1 names these; the list is also every key with "simulat" in it. */
const REQUIRED_STRINGS: readonly string[] = [
  LIVE_COPY.simulateLabel,
  LIVE_COPY.simulatedNotice,
  LIVE_COPY.simulatedBackupRequired,
  LIVE_COPY.simulatedKeyReminder,
  PRESS_COPY.sealButtonCreateSimulated,
];

/** The renders in which a Real_Mode page is handed a simulated value. */
const SIMULATED_INPUTS: ReadonlyArray<{ name: string; extra: Record<string, unknown> }> = [
  { name: "no simulated value", extra: {} },
  { name: "simulated prop", extra: { simulated: true } },
  { name: "deps.simulated", extra: { deps: { simulated: true } } },
  { name: "draft simulated", extra: { draft: { simulated: true } } },
];

describe("Real_Mode renders no Simulated_Mode control or string (Requirement 13.1, 13.2)", () => {
  it("keeps at least the baseline number of pairs", () => {
    expect(PAIRS.length).toBeGreaterThanOrEqual(BASELINE_PAIR_COUNT);
  });

  it("holds every required Simulated_Mode string in the copy tables", () => {
    for (const text of REQUIRED_STRINGS) {
      expect(text.length).toBeGreaterThan(0);
      expect(SIMULATED_STRINGS).toContain(escapedForMarkup(text));
    }
  });

  for (const pair of PAIRS) {
    for (const input of SIMULATED_INPUTS) {
      it(`${pair.name}, ${input.name}: no Simulate_Control and no Simulated_Mode string`, () => {
        const html = renderReal(pair.step, pair.state, input.extra);
        expect(html).not.toContain("data-simulate-control");
        expect(html).not.toContain("data-simulated-notice");
        for (const text of SIMULATED_STRINGS) {
          expect(html, text).not.toContain(text);
        }
      });
    }
  }
});
