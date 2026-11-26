// Feature: 14-write-desk (spec 14, S3 and S6).
//
// Static-markup tests for SealStep: the heading, the paragraph, the Warning_Text,
// the order of the text column, the press column and the one status line.
// Rendered with renderToStaticMarkup, as the other live tests do.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BackupChoice } from "../BackupChoice";
import { LIVE_COPY } from "../copy";
import { PRESS_COPY } from "../press/copy";
import { SealStep, type SealStepProps } from "./SealStep";

const BASE: SealStepProps = {
  tag: "write",
  backupChoice: null,
  onBackupChoice: () => undefined,
  pressBlocked: true,
  ready: false,
  mode: "write",
  questionCount: 0,
  prfMissing: false,
  onCreatePress: () => undefined,
  onConfirmPress: () => undefined,
  onAttempt: () => undefined,
};

function render(props: Partial<SealStepProps> = {}): string {
  return renderToStaticMarkup(createElement(SealStep, { ...BASE, ...props }));
}

describe("SealStep text column (spec 14, S3.1 to S3.4)", () => {
  it("holds one h1 with the Seal heading, focusable from script", () => {
    const html = render();
    expect(html.match(/<h1/g)?.length).toBe(1);
    expect(html).toMatch(
      new RegExp(
        `<h1[^>]*data-step-heading=""[^>]*tabindex="-1"[^>]*>${LIVE_COPY.sealHeading.replace(/\./g, "\\.")}</h1>`,
      ),
    );
    expect(LIVE_COPY.sealHeading).toBe("Press the seal.");
  });

  it("renders the sealParagraph once, exactly as written", () => {
    const html = render();
    // React escapes quotes and apostrophes in markup.
    const escaped = LIVE_COPY.sealParagraph
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");
    expect(html.split(escaped).length - 1).toBe(1);
  });

  it("renders the Warning_Text as plain body text with data-warning-text", () => {
    const html = render();
    expect(html).toMatch(/<p[^>]*data-warning-text=""[^>]*>/);
    expect(html).toContain(LIVE_COPY.warning);
  });

  it("puts the text column before the press column in DOM order", () => {
    const html = render();
    expect(html.indexOf('data-seal-text=""')).toBeLessThan(
      html.indexOf('data-press-column=""'),
    );
    expect(html.indexOf("<h1")).toBeLessThan(
      html.indexOf('data-press-column=""'),
    );
  });

  it("holds the Backup_Choice and the links in the text column, not the press column", () => {
    const html = render();
    const press = html.slice(html.indexOf('data-press-column=""'));
    const text = html.slice(0, html.indexOf('data-press-column=""'));
    expect(text).toContain('data-backup-choice=""');
    expect(text).toContain('data-seal-links=""');
    expect(press).not.toContain('data-backup-choice=""');
  });

  it("renders no eyebrow, no step-name h2 and no passkey step list", () => {
    const html = render();
    expect(html).not.toMatch(/<h2/);
    expect(html).not.toContain(LIVE_COPY.passkeySteps);
    // The intro is a paragraph of its own on the other steps. The Seal paragraph only shares its first sentence.
    expect(html).not.toContain(`>${LIVE_COPY.intro}</p>`);
  });

  it("hides its own h1 when the page holds the step heading", () => {
    const html = render({ showHeading: false });
    expect(html).not.toContain("<h1");
    expect(html).not.toContain('data-step-heading=""');
  });

  it("offers the PRF fallback button only when the PRF check is missing", () => {
    expect(
      render({ prfMissing: false, onBackupStart: () => undefined }),
    ).not.toContain(LIVE_COPY.fallbackButton);
    const html = render({ prfMissing: true, onBackupStart: () => undefined });
    expect(html).toContain(LIVE_COPY.fallbackButton);
    expect(html).toContain(LIVE_COPY.prfHint);
  });

  it("passes the fields problem to the Backup_Choice as its message", () => {
    const html = render({
      backupChoiceProblem: LIVE_COPY.backupChoiceUnchosen,
    });
    expect(html).toContain(LIVE_COPY.backupChoiceUnchosen);
  });

  it("disables the Backup_Choice radios outside the write state (S4.7)", () => {
    expect(render({ tag: "write" })).not.toMatch(
      /type="radio"[^>]*disabled=""/,
    );
    expect(render({ tag: "creating" })).toMatch(/type="radio"[^>]*disabled=""/);
    const choice = renderToStaticMarkup(
      createElement(BackupChoice, {
        value: null,
        onChange: () => undefined,
        disabled: true,
      }),
    );
    expect(choice).toMatch(/type="radio"[^>]*disabled=""/);
  });
});

describe("SealStep press column (spec 14, S6)", () => {
  it("shows the envelope caption with the question count", () => {
    expect(render({ questionCount: 0 })).toContain(
      "To me, on opening day</span>",
    );
    expect(render({ questionCount: 2 })).toContain(
      "To me, on opening day · 2 questions on top",
    );
  });

  it("names the press for assistive technology and keeps one press", () => {
    const html = render();
    expect(html.match(/aria-label="Press the seal"/g)?.length).toBe(1);
  });

  it("shows the choose-first line before a choice is made, muted", () => {
    const html = render({ backupChoice: null });
    expect(html).toContain(PRESS_COPY.chooseFirst);
    expect(html).toMatch(/data-press-line=""[^>]*data-tone="muted"/);
  });

  it("shows the hold line, not the fix-fields line, when no field has a problem", () => {
    const html = render({
      backupChoice: "skip",
      pressBlocked: true,
      fieldProblem: false,
    });
    expect(html).toContain(PRESS_COPY.holdToSeal);
    expect(html).not.toContain(PRESS_COPY.fixFields);
    expect(html).not.toContain(PRESS_COPY.chooseFirst);
  });

  it("shows the fix-fields line, not the hold line, when a field has a problem (spec 20, Requirement 2.2)", () => {
    const html = render({
      backupChoice: "skip",
      pressBlocked: true,
      fieldProblem: true,
    });
    expect(html).toContain(PRESS_COPY.fixFields);
    expect(html).not.toContain(PRESS_COPY.holdToSeal);
    expect(html).toMatch(/data-press-line=""[^>]*data-tone="muted"/);
  });

  it("shows the hold line in accent once a choice is made with full motion", () => {
    // Full motion is the default: no Calm, no reduced-motion media query on the server.
    const html = render({
      backupChoice: "card",
      pressBlocked: false,
      ready: true,
    });
    expect(html).toContain(PRESS_COPY.holdToSeal);
    expect(html).toMatch(/data-press-line=""[^>]*data-tone="accent"/);
  });

  it("marks the press ready only when it can be used (S6.5)", () => {
    expect(render({ ready: true, pressBlocked: false })).toMatch(
      /<button[^>]*data-ready=""/,
    );
    expect(render({ ready: false })).not.toMatch(/data-ready=/);
  });

  it("shows the Setting_State line on the created state", () => {
    const html = render({
      tag: "created",
      mode: "setting",
      pressBlocked: false,
    });
    expect(html).toContain(PRESS_COPY.setting);
  });

  it("keeps the status line non-empty for every seal state", () => {
    for (const tag of [
      "write",
      "creating",
      "created",
      "confirming",
      "preparing",
      "sealing",
    ] as const) {
      const html = render({
        tag,
        pressBlocked: tag !== "created" && tag !== "write",
      });
      const match = /data-press-line=""[^>]*>([^<]*)</.exec(html);
      expect(match?.[1].length ?? 0, tag).toBeGreaterThan(0);
    }
  });
});

describe("SealStep opening slot (spec 19)", () => {
  it("places the opening before the backup choice and the press", () => {
    const html = render({
      opening: createElement("p", null, "OPENING_MARK"),
    });
    const at = html.indexOf('data-seal-opening=""');
    expect(at).toBeGreaterThan(-1);
    expect(html.indexOf("OPENING_MARK")).toBeGreaterThan(at);
    expect(at).toBeLessThan(html.indexOf('data-backup-choice=""'));
    expect(at).toBeLessThan(html.indexOf('data-press-column=""'));
    expect(at).toBeGreaterThan(html.indexOf('data-seal-text=""'));
  });

  it("renders no opening wrapper when no opening is given", () => {
    expect(render()).not.toContain('data-seal-opening=""');
  });
});
