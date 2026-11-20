import { describe, expect, it } from "vitest";

// First-load JavaScript for the opening flow, measured after the shared
// OpeningFlow is loaded with next/dynamic on /demo/live and rendered on /l/[id].
//
// Measured with `npm run build`, then `node scripts/check-js-budget.mjs`
// (Next 16 layout: the sum is an approximation of First Load JS), on 2026-11-21.
// Gzip level 9, kB = 1,000 bytes.

// Measured 236.6 kB (14 chunks) on /demo/live.
const MEASURED_DEMO_LIVE_KB = 236.6;
// Budget for /demo/live from .kiro/specs/15-the-flow/design.md (section "Testing Strategy").
const DEMO_LIVE_BUDGET_KB = 280;

// Measured 236.8 kB (15 chunks) on /l/[id].
const MEASURED_LETTER_LINK_KB = 236.8;
// Budget for /l/[id] from scripts/check-js-budget.mjs, the same budget the build check enforces.
const LETTER_LINK_BUDGET_KB = 260;

describe("opening flow first-load budget", () => {
  it("keeps /demo/live within its budget", () => {
    expect(MEASURED_DEMO_LIVE_KB).toBeLessThanOrEqual(DEMO_LIVE_BUDGET_KB);
  });

  it("keeps /l/[id] within its budget", () => {
    expect(MEASURED_LETTER_LINK_KB).toBeLessThanOrEqual(LETTER_LINK_BUDGET_KB);
  });
});
