// Feature: 13-the-seal
//
// Static-markup tests for PressEnvelope (spec 13, design section 2, P1.2, P1.5).
// Rendered with renderToStaticMarkup and createElement, as the other live
// tests do. Pointer behaviour is covered by usePressEnvelope.test.ts.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PRESS_COPY } from "./copy";
import { PressEnvelope } from "./PressEnvelope";
import type { PressEnvelopeProps } from "./PressEnvelope";

function render(props: Partial<PressEnvelopeProps> = {}): string {
  return renderToStaticMarkup(createElement(PressEnvelope, props));
}

/** The id of the description paragraph, which the button points at. */
function describedById(html: string): string {
  const match = /<p id="([^"]+)"/.exec(html);
  if (match === null) throw new Error("no description paragraph in the markup");
  return match[1];
}

describe("PressEnvelope, one focusable control (P1.2)", () => {
  it("is a single native button named for pressing the seal", () => {
    const html = render();
    expect(html.match(/<button/g)?.length).toBe(1);
    expect(html).toContain('type="button"');
    expect(html).toContain(`aria-label="${PRESS_COPY.name}"`);
    expect(PRESS_COPY.name).toBe("Press the seal");
  });

  it("describes the button by its one plain line", () => {
    const html = render({ disabled: true });
    const id = describedById(html);
    expect(html).toContain(`aria-describedby="${id}"`);
  });

  it("keeps the hit area at least 44 CSS px square in its stylesheet", () => {
    const css = readFileSync(
      fileURLToPath(new URL("./press.module.css", import.meta.url)),
      "utf8",
    );
    const block = /\.press\s*\{([^}]*)\}/.exec(css);
    expect(block).not.toBeNull();
    expect(block?.[1]).toMatch(/min-width:\s*44px/);
    expect(block?.[1]).toMatch(/min-height:\s*44px/);
  });
});

describe("PressEnvelope, disabled until a Backup_Choice is made (P1.5)", () => {
  it("sets aria-disabled to true and shows the one plain line", () => {
    const html = render({ disabled: true });
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain(PRESS_COPY.chooseFirst);
  });

  it("sets aria-disabled to false and shows no line once enabled", () => {
    const html = render({ disabled: false });
    expect(html).toContain('aria-disabled="false"');
    expect(html).not.toContain(PRESS_COPY.chooseFirst);
  });

  it("lets the caller replace the plain line", () => {
    const html = render({ disabled: true, line: "Something else." });
    expect(html).toContain("Something else.");
    expect(html).not.toContain(PRESS_COPY.chooseFirst);
  });
});

describe("PressEnvelope, modes and pose", () => {
  it("marks the inert control as disabled and sets no line", () => {
    const html = render({ inert: true, pose: "lifted" });
    expect(html).toContain('data-press-mode="inert"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain(PRESS_COPY.chooseFirst);
  });

  it("carries the wax and Signet pose on the button", () => {
    expect(render({ pose: "lifted" })).toContain('data-seal-pose="lifted"');
    expect(render()).toContain('data-seal-pose="unpressed"');
  });

  it("marks the setting press with its mode", () => {
    expect(render({ mode: "setting" })).toContain('data-press-mode="setting"');
  });

  it("hides the drawing from assistive technology", () => {
    expect(render()).toContain('aria-hidden="true"');
  });
});

describe("PressEnvelope, Setting_State (P5.4 to P5.6)", () => {
  it("shows the one plain Setting_State line", () => {
    const html = render({ mode: "setting", pose: "setting" });
    expect(html).toContain(PRESS_COPY.setting);
    expect(html).toContain('data-seal-pose="setting"');
    expect(html).toContain('data-press-mode="setting"');
  });

  it("never shows 'Confirm your passkey' and never a second button", () => {
    const html = render({ mode: "setting", pose: "setting" });
    expect(html).not.toMatch(/confirm your passkey/i);
    expect(html.match(/<button/g)?.length).toBe(1);
  });

  it("keeps the setting line in a status region the button describes", () => {
    const html = render({ mode: "setting", pose: "setting" });
    expect(html).toContain('role="status"');
    expect(html).toContain(`aria-describedby="${describedById(html)}"`);
  });

  it("does not show the choose-first line in the Setting_State", () => {
    const html = render({ mode: "setting", pose: "setting", disabled: false });
    expect(html).not.toContain(PRESS_COPY.chooseFirst);
  });
});

describe("PressEnvelope, failure lift (P4.3, P4.4)", () => {
  it("renders the lifted seal with no pool stage and no press", () => {
    const html = render({ inert: true, pose: "lifted" });
    expect(html).toContain('data-seal-pose="lifted"');
    expect(html).toContain('data-press-mode="inert"');
    expect(html).not.toContain("data-pool-stage");
    expect(html).toContain('aria-disabled="true"');
  });

  it("shows no line and no Setting_State copy once lifted", () => {
    const html = render({ inert: true, pose: "lifted", mode: "setting" });
    expect(html).not.toContain(PRESS_COPY.setting);
    expect(html).not.toContain(PRESS_COPY.chooseFirst);
  });
});
