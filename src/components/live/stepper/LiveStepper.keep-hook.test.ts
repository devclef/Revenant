import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// Spec 16, requirement 1.8: LiveStepper must not call the Keep_Hook. Each
// Field_Group calls it through KeepGroup. A whole-step call would measure the
// step card, not the field the reader is typing in.
const source = readFileSync(new URL("./LiveStepper.tsx", import.meta.url), "utf8");

describe("LiveStepper and the Keep_Hook", () => {
  it("does not import or call useKeepInVisualViewport", () => {
    expect(source).not.toMatch(/\buseKeepInVisualViewport\b/);
  });

  it("keeps primaryRef for the step-heading focus", () => {
    expect(source).toMatch(/primaryRef\.current\s*\?\.querySelector<HTMLElement>\("\[data-step-heading\]"\)/);
  });
});
