// Static-markup tests for WriteForm and SealPage (spec 06, Task 5; R12.2, R12.7,
// R15.2, R15.11, R15.12). Interaction is not tested here; these tests check the
// initial markup, the order of its parts, the warning gate and the disabled
// button, and that the component source makes no network call.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEMO_COPY } from "@/components/demo/copy";
import { DEMO_FIGURES } from "@/lib/figures/demo";

import { listPickableSeries } from "./catalogue-list";
import { validateWrite } from "./form";
import { LIVE_COPY } from "./copy";
import { SealPage } from "./SealPage";
import { PROBLEM_COPY, WriteForm } from "./WriteForm";

const SERIES = listPickableSeries(DEMO_FIGURES);
const DIR = join(fileURLToPath(new URL(".", import.meta.url)));

// React escapes quotes in static markup, so copy with quotes is compared in
// its escaped form. Matches React's escapeTextForBrowser for & < > " '.
function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function renderWriteForm(): string {
  return renderToStaticMarkup(createElement(WriteForm, { series: SERIES }));
}

describe("WriteForm", () => {
  const html = renderWriteForm();

  it("puts the Demo label before the heading", () => {
    expect(html.indexOf(DEMO_COPY.demoLabel)).toBeGreaterThanOrEqual(0);
    expect(html.indexOf(DEMO_COPY.demoLabel)).toBeLessThan(
      html.indexOf(LIVE_COPY.heading),
    );
  });

  it("renders the parts in the specified order", () => {
    const order = [
      LIVE_COPY.heading,
      LIVE_COPY.intro,
      LIVE_COPY.letterLabel,
      LIVE_COPY.figuresLegend,
      LIVE_COPY.passkeySteps,
      LIVE_COPY.crossDevice,
      LIVE_COPY.warningLabel,
      LIVE_COPY.createButton,
    ];
    let last = -1;
    for (const part of order) {
      const at = html.indexOf(esc(part));
      expect(at, part).toBeGreaterThan(last);
      last = at;
    }
  });

  it("names Revenant demo in the passkey explanation", () => {
    expect(LIVE_COPY.passkeySteps).toContain("Revenant demo");
    expect(html).toContain(esc(LIVE_COPY.passkeySteps));
  });

  it("shows the live count of the letter, starting at zero", () => {
    expect(html).toContain("0 of 5,000 characters");
  });

  it("starts with the warning box unticked", () => {
    expect(html).toContain('id="live-warning"');
    expect(html).not.toMatch(/<input[^>]*id="live-warning"[^>]*checked/);
  });

  it("shows the lost-passkey warning in plain words", () => {
    expect(html).toContain(LIVE_COPY.warning);
  });

  it("renders the picker with the series", () => {
    for (const item of SERIES) {
      expect(html).toContain(item.displayName);
    }
  });

  it("disables the create button and shows the not-yet line", () => {
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*>Create your passkey<\/button>/,
    );
    expect(html).toContain(LIVE_COPY.notYet);
    expect(html).toContain('role="status"');
  });

  it("refuses a warning that is unticked, so nothing can start", () => {
    const problems = validateWrite({
      text: "A letter",
      metricIds: [SERIES[0]!.metricId],
      warningTicked: false,
    });
    expect(problems).toEqual(["warning_unticked"]);
  });

  it("makes no network call in its source", () => {
    for (const file of ["WriteForm.tsx", "FigurePicker.tsx", "SealPage.tsx"]) {
      const source = readFileSync(join(DIR, file), "utf8");
      expect(source, file).not.toMatch(/\bfetch\(/);
      expect(source, file).not.toMatch(/XMLHttpRequest|navigator\.sendBeacon/);
    }
  });

  it("shows each missing-input message next to its field on first render", () => {
    // A new form has an empty letter, no figures and an unticked warning.
    expect(html).toContain(esc(LIVE_COPY.letterEmpty));
    expect(html).toContain(esc(LIVE_COPY.figuresNone));
    expect(html).toContain(esc(LIVE_COPY.warningUnticked));
    expect(html.indexOf(esc(LIVE_COPY.letterEmpty))).toBeLessThan(
      html.indexOf('id="live-figures-problem"'),
    );
    expect(html.indexOf(esc(LIVE_COPY.figuresNone))).toBeLessThan(
      html.indexOf('id="live-warning"'),
    );
  });

  it("maps each rendered write problem to its message", () => {
    expect(PROBLEM_COPY.letter_empty).toBe(LIVE_COPY.letterEmpty);
    expect(PROBLEM_COPY.letter_too_long).toBe(LIVE_COPY.letterTooLong);
    expect(PROBLEM_COPY.figures_none).toBe(LIVE_COPY.figuresNone);
    expect(PROBLEM_COPY.warning_unticked).toBe(LIVE_COPY.warningUnticked);
  });

  it("gives the warning message the same field-level id the checkbox names", () => {
    expect(html).toMatch(
      /<input[^>]*id="live-warning"[^>]*aria-describedby="live-warning-problem"/,
    );
    expect(html).toContain('id="live-warning-problem"');
  });
});

describe("Seal_Page panel", () => {
  const css = readFileSync(join(DIR, "live.module.css"), "utf8");
  const panel = /\.panel\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";

  it("keeps the paper background and padding", () => {
    expect(panel).toMatch(/background-color:\s*var\(--paper\)/);
    expect(panel).toMatch(/padding:/);
  });

  it("has no outer border", () => {
    expect(panel).not.toMatch(/\bborder\s*:/);
    expect(panel).not.toContain("gold-leaf");
  });
});

describe("SealPage", () => {
  it("composes the write form", () => {
    const html = renderToStaticMarkup(
      createElement(SealPage, {
        rpId: "revenant.devclef.se",
        appOrigin: "https://revenant.devclef.se",
      }),
    );

    expect(html).toContain(LIVE_COPY.heading);
    expect(html).toContain(LIVE_COPY.createButton);
  });
});
