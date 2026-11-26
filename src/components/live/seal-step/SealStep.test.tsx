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
import { SealButton } from "./SealButton";
import { SealStep, type SealStepProps } from "./SealStep";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

describe("SealStep Seal_Button placement and wiring (spec 20, Part C)", () => {
  const here = dirname(fileURLToPath(import.meta.url));

  it("places the Seal_Button in the press column, after the envelope and before the steps", () => {
    const html = render({
      backupChoice: "skip",
      pressBlocked: false,
      ready: true,
    });
    const column = html.indexOf('data-press-column=""');
    const button = html.indexOf("data-seal-button");
    const envelope = html.indexOf('aria-label="Press the seal"');
    const steps = html.indexOf('data-seal-steps=""');
    expect(column).toBeGreaterThan(-1);
    expect(button).toBeGreaterThan(column);
    expect(envelope).toBeGreaterThan(column);
    expect(button).toBeGreaterThan(envelope);
    expect(steps).toBeGreaterThan(button);
  });

  it("holds exactly one Seal_Button, and none in the text column", () => {
    const html = render({
      backupChoice: "skip",
      pressBlocked: false,
      ready: true,
    });
    expect(html.match(/data-seal-button=""/g)?.length).toBe(1);
    const text = html.slice(0, html.indexOf('data-press-column=""'));
    expect(text).not.toContain("data-seal-button");
  });

  it("points the Seal_Button at the status line that shows the fix-fields line", () => {
    const html = render({
      backupChoice: "skip",
      pressBlocked: true,
      fieldProblem: true,
    });
    const described = /data-seal-button=""[^>]*aria-describedby="([^"]+)"/.exec(
      html,
    )?.[1];
    expect(described).toBeTruthy();
    const line =
      new RegExp(`id="${described}"[^>]*data-press-line=""[^>]*>([^<]*)<`).exec(
        html,
      ) ??
      new RegExp(`data-press-line=""[^>]*id="${described}"[^>]*>([^<]*)<`).exec(
        html,
      );
    expect(line?.[1]).toBe(PRESS_COPY.fixFields);
  });

  it("shows the fix-fields line on the Seal step when a field has a problem and a choice is made", () => {
    const html = render({
      backupChoice: "card",
      pressBlocked: true,
      fieldProblem: true,
    });
    expect(html).toContain(PRESS_COPY.fixFields);
    expect(html).not.toContain(PRESS_COPY.holdToSeal);
    // pressToSeal's wording also appears in the step hints under the wax, so
    // check the status line itself.
    const line = /data-press-line=""[^>]*>([^<]*)</.exec(html)?.[1];
    expect(line).toBe(PRESS_COPY.fixFields);
  });

  it("gives the Seal_Button no pointer handlers, so only its click starts the press", () => {
    const element = SealButton({
      label: PRESS_COPY.stepOne,
      blocked: false,
      lineId: "line",
      onActivate: () => undefined,
    });
    const props = element.props as Record<string, unknown>;
    expect(props).not.toHaveProperty("onPointerDown");
    expect(props).not.toHaveProperty("onPointerUp");
    expect(props).not.toHaveProperty("onPointerCancel");
    expect(props).not.toHaveProperty("onMouseDown");
    expect(props).not.toHaveProperty("onKeyDown");
    expect(typeof props.onClick).toBe("function");
  });

  it("the Seal_Button source names no pointer handler", () => {
    const source = readFileSync(join(here, "SealButton.tsx"), "utf8");
    expect(source).not.toMatch(/onPointer/);
    expect(source).not.toMatch(/onMouseDown/);
  });
});
