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

  it("states the open-letter receipts wording verbatim in both files (Requirements 6.5, 6.6)", () => {
    expect(README).toContain(
      "6. **Receipts.** Break the seal. Each question with what you remembered beside the answer you sealed. The letter stays open, beside them on a wide screen and in its place on a phone. Then any figures, then and now. Revenant does not explain the difference.",
    );
    expect(VIDEO_SCRIPT).toContain(
      "3. The letter, in full, on warm paper. It stays open the whole time: beside items 1 and 2 on a wide screen, and between them on a phone.",
    );
  });

  it("contains no 'Read the letter again' fold in either file", () => {
    expect(README).not.toContain(RECEIPTS_LETTER_FOLD);
    expect(VIDEO_SCRIPT).not.toContain(RECEIPTS_LETTER_FOLD);
  });

  it("keeps the fold out of the receipts lines in both files (Requirement 6.5)", () => {
    const readmeReceipts = /^6\. \*\*Receipts\.\*\*.*$/m.exec(README)?.[0] ?? "";
    const videoReceipts = /^\s*3\. The letter, in full.*$/m.exec(VIDEO_SCRIPT)?.[0] ?? "";
    expect(readmeReceipts).not.toBe("");
    expect(videoReceipts).not.toBe("");
    expect(readmeReceipts).not.toMatch(/fold/i);
    expect(videoReceipts).not.toMatch(/fold/i);
  });

  it("no longer contains the retired teacher and tenure detail in the README", () => {
    expect(README).not.toContain("English teacher");
    expect(README).not.toContain("fifteen years");
  });

  // Requirement 17.5: the alt text names the words the image shows today. The
  // owner redrew the one-pager in 6467582, so it now shows the three steps
  // Write and press the seal, Remember first, and Receipts, and no Testify.
  it("names the words the README image shows today in its alt text (Requirement 17.5)", () => {
    const alt = /<img[^>]*alt="([^"]*)"/.exec(README)?.[1] ?? "";
    expect(alt).toContain("Write and press the seal");
    expect(alt).toContain("Remember first");
    expect(alt).toContain("Receipts");
    expect(alt).not.toMatch(/testif|testimon/i);
  });

  it("keeps the provenance comments in the video script", () => {
    expect(VIDEO_SCRIPT).toContain("<!-- provenance:");
  });
});
