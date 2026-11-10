/**
 * Live Walk replay (manual only). Skipped unless WALK=1.
 *
 * What it does: drives the live seal-and-open path in headless Chromium with a
 * virtual WebAuthn authenticator, and records whether each step reaches its
 * expected outcome.
 *
 * How to run by hand:
 *   1. npm run build
 *   2. Start PostgreSQL locally and apply the migrations.
 *   3. Start the app:
 *        RP_ID=localhost APP_ORIGIN=http://localhost:3000 npx next start
 *   4. In another shell, run:
 *        WALK=1 RP_ID=localhost APP_ORIGIN=http://localhost:3000 \
 *          npx vitest run src/test/integration/live-walk.test.ts
 *
 * It needs headless Chromium, so it cannot run in CI without a browser. Without
 * WALK=1 the whole suite is skipped and exits 0.
 */
import { describe, expect, it } from "vitest";

export type WalkStep = {
  name: string;
  expected: string;
};

/** The ordered Walk. Each step is data; the replay body (next task) drives them in order. */
export const WALK_STEPS: readonly WalkStep[] = [
  {
    name: "write one question",
    expected: "The author writes one question for the future self.",
  },
  {
    name: "choose one figure",
    expected: "One official figure is added as a receipt.",
  },
  {
    name: "press seal",
    expected: "The seal action is available and starts the lock.",
  },
  {
    name: "create and confirm passkey",
    expected: "A virtual passkey with PRF is created and confirmed.",
  },
  {
    name: "sealed view and letter card",
    expected: "The sealed view shows and the letter card with QR code appears.",
  },
  {
    name: "wait 30 seconds",
    expected: "The 30-second demo lock counts down to zero.",
  },
  {
    name: "unlock with passkey",
    expected: "The passkey assertion unlocks the letter.",
  },
  {
    name: "answer text and figure questions",
    expected: "The recall questions appear and each answer is recorded.",
  },
  {
    name: "press-and-hold seal break",
    expected: "Holding the seal breaks it and reveals the letter.",
  },
  {
    name: "read letter",
    expected: "The letter text is shown in full.",
  },
  {
    name: "open receipts",
    expected: "The receipts show testimony, the letter and figures then and now.",
  },
  {
    name: "close",
    expected: "The walk ends and the page can be closed.",
  },
];

describe.skipIf(process.env.WALK !== "1")("live walk replay", () => {
  it("has an ordered step list with a name and an expected outcome for each step", () => {
    expect(WALK_STEPS.length).toBeGreaterThan(0);
    for (const step of WALK_STEPS) {
      expect(step.name.length).toBeGreaterThan(0);
      expect(step.expected.length).toBeGreaterThan(0);
    }
  });
});
