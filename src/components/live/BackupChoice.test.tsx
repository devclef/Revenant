// Feature: 13-the-seal, 14-write-desk
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

import { BackupChoice } from "./BackupChoice";
import { LIVE_COPY } from "./copy";

const render = (
  value: "card" | "skip" | null = null,
  problem?: string,
  disabled?: boolean,
) =>
  renderToStaticMarkup(
    createElement(BackupChoice, {
      value,
      onChange: () => {},
      problem,
      disabled,
    }),
  );

/** The `<label>` element that wraps the radio with this id. */
const cardFor = (html: string, value: "card" | "skip"): string =>
  html.match(
    new RegExp(
      `<label[^>]*data-backup-card="${value}"[^>]*>[\\s\\S]*?</label>`,
    ),
  )?.[0] ?? "";

describe("BackupChoice (spec 13, P7; spec 14, S4)", () => {
  it("is a fieldset with a visible legend", () => {
    const html = render();
    expect(html).toMatch(/<fieldset[^>]*data-backup-choice/);
    expect(html).toContain(`<legend`);
    expect(html).toContain(LIVE_COPY.backupChoiceLegend);
    expect(LIVE_COPY.backupChoiceLegend).toBe("If you lose this passkey");
  });

  it("offers two native radios, both unchecked at the start (P7.2)", () => {
    const html = render();
    expect(html.match(/type="radio"/g)).toHaveLength(2);
    expect(html).toContain(LIVE_COPY.backupChoiceCard);
    expect(html).toContain(LIVE_COPY.backupChoiceSkip);
    expect(html).not.toMatch(/checked=""/);
    expect(html).not.toMatch(/ checked/);
  });

  it("wraps each radio in its own label, with the title as the label text", () => {
    const html = render();
    for (const value of ["card", "skip"] as const) {
      const label = cardFor(html, value);
      expect(label).not.toBe("");
      expect(label).toMatch(/<input[^>]*type="radio"/);
    }
    const card = cardFor(html, "card");
    expect(card).toContain(LIVE_COPY.backupChoiceCard);
    expect(card).toContain(`for="live-backup-choice-card"`);
  });

  it("links each radio to its help line by id", () => {
    const html = render();
    for (const id of ["live-backup-choice-card", "live-backup-choice-skip"]) {
      expect(html).toContain(`aria-describedby="${id}-help"`);
      expect(html).toMatch(new RegExp(`<span id="${id}-help"`));
    }
    expect(html).toContain(LIVE_COPY.backupChoiceCardHelp);
    expect(html).toContain(LIVE_COPY.backupChoiceSkipHelp);
  });

  it("hides the circle from assistive technology", () => {
    const html = render();
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(2);
  });

  it("checks only the selected option", () => {
    const html = render("skip");
    const skip =
      html.match(/<input[^>]*id="live-backup-choice-skip"[^>]*>/)?.[0] ?? "";
    const card =
      html.match(/<input[^>]*id="live-backup-choice-card"[^>]*>/)?.[0] ?? "";
    expect(skip).toContain("checked");
    expect(card).not.toContain("checked");
  });

  it("is enabled by default and disabled while a prompt or sealing runs (S4.7)", () => {
    const enabled = render();
    expect(
      enabled
        .match(/<input[^>]*type="radio"[^>]*>/g)
        ?.every((i) => !i.includes("disabled")),
    ).toBe(true);
    const disabled = render("card", undefined, true);
    expect(disabled.match(/<input[^>]*type="radio"[^>]*>/g)).toHaveLength(2);
    for (const input of disabled.match(/<input[^>]*type="radio"[^>]*>/g) ??
      []) {
      expect(input).toContain("disabled");
    }
  });

  it("keeps the checked option checked while disabled (S4.7)", () => {
    const html = render("skip", undefined, true);
    const skip =
      html.match(/<input[^>]*id="live-backup-choice-skip"[^>]*>/)?.[0] ?? "";
    expect(skip).toContain("checked");
    expect(skip).toContain("disabled");
  });

  it("shows the problem line only when one is given", () => {
    expect(render(null, LIVE_COPY.backupChoiceUnchosen)).toContain(
      LIVE_COPY.backupChoiceUnchosen,
    );
    expect(render(null)).not.toContain(
      'aria-describedby="live-backup-choice-problem"',
    );
  });
});
