// The Wait step keeps the Demo label on its backup key card (issue #661). The
// real-mode Keep step hides it, but the rehearsal Wait card must still show it.
// The backup card only renders after a click, so this checks the wiring in the
// source: the BackupKeyCard element passes no showDemoLabel prop, which leaves
// the default (true) in place.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./LiveWaitStep.tsx", import.meta.url), "utf8");

describe("LiveWaitStep keeps the Demo label on the backup key card", () => {
  it("renders BackupKeyCard without a showDemoLabel prop", () => {
    const element = source.match(/<BackupKeyCard\b[^>]*\/>/)?.[0] ?? "";
    expect(element).not.toBe("");
    expect(element).not.toContain("showDemoLabel");
  });
});
