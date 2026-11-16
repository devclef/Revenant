// Feature: 13-the-seal
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

import { BackupChoice } from "./BackupChoice";
import { LIVE_COPY } from "./copy";

const render = (value: "card" | "skip" | null = null, problem?: string) =>
  renderToStaticMarkup(createElement(BackupChoice, { value, onChange: () => {}, problem }));

describe("BackupChoice (spec 13, P7)", () => {
  it("is a fieldset with a visible legend", () => {
    const html = render();
    expect(html).toMatch(/<fieldset[^>]*data-backup-choice/);
    expect(html).toContain(`<legend`);
    expect(html).toContain(LIVE_COPY.backupChoiceLegend);
  });

  it("offers two native radios, both unchecked at the start (P7.2)", () => {
    const html = render();
    expect(html.match(/type="radio"/g)).toHaveLength(2);
    expect(html).toContain(LIVE_COPY.backupChoiceCard);
    expect(html).toContain(LIVE_COPY.backupChoiceSkip);
    expect(html).not.toMatch(/checked=""/);
    expect(html).not.toMatch(/ checked/);
  });

  it("checks only the selected option", () => {
    const html = render("skip");
    const skip = html.match(/<input[^>]*id="live-backup-choice-skip"[^>]*>/)?.[0] ?? "";
    const card = html.match(/<input[^>]*id="live-backup-choice-card"[^>]*>/)?.[0] ?? "";
    expect(skip).toContain("checked");
    expect(card).not.toContain("checked");
  });

  it("shows the problem line only when one is given", () => {
    expect(render(null, LIVE_COPY.backupChoiceUnchosen)).toContain(LIVE_COPY.backupChoiceUnchosen);
    expect(render(null)).not.toContain('aria-describedby="live-backup-choice-problem"');
  });
});
