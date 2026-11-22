import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Spec 16, Requirement 17.4 and 17.5. Lives under src/lib (the agent's own
// test path), not src/test, per the platform-dev test location rule.
const readDoc = (relative: string): string =>
  readFileSync(
    fileURLToPath(new URL(`../../${relative}`, import.meta.url)),
    "utf8",
  );

const README = readDoc("README.md");
const VIDEO_SCRIPT = readDoc("docs/video-script.md");

const HEADLINE = "Memory drifts with time. A sealed letter doesn't.";
const RECEIPTS_LETTER_FOLD = "Read the letter again";

describe("README and video script wording (spec 16, Requirement 17.4)", () => {
  it("carries the Requirement 5.1 headline in both files", () => {
    expect(README).toContain(HEADLINE);
    expect(VIDEO_SCRIPT).toContain(HEADLINE);
  });

  it("names the third step Remember in both files", () => {
    expect(README).toContain("Remember");
    expect(VIDEO_SCRIPT).toContain("Remember");
  });

  it("carries the Requirement 10.1 receipts order, with the folded letter last, in both files", () => {
    expect(README).toContain("Receipts");
    expect(README.indexOf("Then any figures")).toBeGreaterThan(-1);
    expect(README.indexOf(RECEIPTS_LETTER_FOLD)).toBeGreaterThan(
      README.indexOf("Then any figures"),
    );

    expect(VIDEO_SCRIPT).toContain(RECEIPTS_LETTER_FOLD);
    expect(
      VIDEO_SCRIPT.indexOf("The figures, if the letter holds any"),
    ).toBeGreaterThan(-1);
    expect(VIDEO_SCRIPT.indexOf(RECEIPTS_LETTER_FOLD)).toBeGreaterThan(
      VIDEO_SCRIPT.indexOf("The figures, if the letter holds any"),
    );
  });

  it("no longer contains the retired teacher and tenure detail in the README", () => {
    expect(README).not.toContain("English teacher");
    expect(README).not.toContain("fifteen years");
  });

  it("keeps Testify in the README image alt text (Requirement 17.5)", () => {
    const alt = /<img[^>]*alt="([^"]*)"/.exec(README)?.[1] ?? "";
    expect(alt).toContain("Testify");
  });

  it("keeps the provenance comments in the video script", () => {
    expect(VIDEO_SCRIPT).toContain("<!-- provenance:");
  });
});
