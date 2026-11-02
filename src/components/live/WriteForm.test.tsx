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
import type { SealState } from "./seal-machine";
import { SealPage } from "./SealPage";
import { PROBLEM_COPY, WriteForm, type WriteFormProps } from "./WriteForm";

const SERIES = listPickableSeries(DEMO_FIGURES);
const DIR = join(fileURLToPath(new URL(".", import.meta.url)));

/** WriteForm props with sensible defaults; override per test. */
function formProps(over: Partial<WriteFormProps> = {}): WriteFormProps {
  return {
    series: SERIES,
    state: { tag: "write" } as SealState,
    cryptoLoaded: true,
    onCreatePress: () => {},
    onConfirmPress: () => {},
    text: "",
    metricIds: [],
    warningTicked: false,
    onTextChange: () => {},
    onToggleFigure: () => {},
    onWarningChange: () => {},
    ...over,
  };
}

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

function renderWriteForm(over: Partial<WriteFormProps> = {}): string {
  return renderToStaticMarkup(createElement(WriteForm, formProps(over)));
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

  it("disables the create button until the crypto module has loaded (R15.3)", () => {
    const notLoaded = renderWriteForm({ cryptoLoaded: false });
    expect(notLoaded).toMatch(
      /<button[^>]*disabled=""[^>]*>Create your passkey<\/button>/,
    );
  });

  it("keeps the create button in its create label in the write state", () => {
    expect(html).toContain(esc(LIVE_COPY.createButton));
    expect(html).not.toContain(esc(LIVE_COPY.confirmButton));
  });

  it("swaps to the confirm label once a passkey is created", () => {
    const created = renderWriteForm({ state: { tag: "created" } });
    expect(created).toContain(esc(LIVE_COPY.confirmButton));
    expect(created).not.toContain(esc(LIVE_COPY.createButton));
  });

  it("renders a role=status line and never the old not-yet line", () => {
    expect(html).toContain('role="status"');
    expect(html).not.toContain("Sealing opens soon.");
  });

  it("shows the matching step line in a mid-flow state", () => {
    const confirming = renderWriteForm({ state: { tag: "confirming" } });
    expect(confirming).toContain(LIVE_COPY.stepConfirming);
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

describe("WriteForm — create button label and state", () => {
  const validDraft = {
    text: "A letter",
    metricIds: [SERIES[0]!.metricId],
    warningTicked: true,
  };

  /** The opening tag of the one button in the markup. */
  function buttonTag(markup: string): string {
    return /<button[^>]*>/.exec(markup)?.[0] ?? "";
  }

  const midFlow = [
    "creating",
    "confirming",
    "preparing",
    "sealing",
    "fallback_key",
  ] as const;
  const terminal = ["cancelled", "failed", "cannot_lock", "sealed"] as const;

  it("is enabled in write with valid input, and labelled Create", () => {
    const html = renderWriteForm({ ...validDraft, state: { tag: "write" } });
    expect(buttonTag(html)).not.toContain("disabled");
    expect(html).toContain(esc(LIVE_COPY.createButton));
  });

  it("is disabled in write while the input is invalid", () => {
    const html = renderWriteForm({ state: { tag: "write" } });
    expect(buttonTag(html)).toContain("disabled");
  });

  it("is enabled in created and labelled Confirm", () => {
    const html = renderWriteForm({
      ...validDraft,
      state: { tag: "created" },
    });
    expect(buttonTag(html)).not.toContain("disabled");
    expect(html).toContain(esc(LIVE_COPY.confirmButton));
    expect(html).not.toContain(esc(LIVE_COPY.createButton));
  });

  it("stays enabled in created even with the input no longer valid", () => {
    // The input was valid when the passkey was created; Confirm does not re-check it.
    const html = renderWriteForm({
      state: { tag: "created" },
      text: "",
      metricIds: [],
      warningTicked: false,
    });
    expect(buttonTag(html)).not.toContain("disabled");
    expect(html).toContain(esc(LIVE_COPY.confirmButton));
  });

  it.each(midFlow)("is disabled in %s", (tag) => {
    const html = renderWriteForm({ ...validDraft, state: { tag } as SealState });
    expect(buttonTag(html)).toContain("disabled");
  });

  it.each(midFlow)("keeps the Create label in %s", (tag) => {
    const html = renderWriteForm({ ...validDraft, state: { tag } as SealState });
    expect(html).toContain(esc(LIVE_COPY.createButton));
    expect(html).not.toContain(esc(LIVE_COPY.confirmButton));
  });

  it.each(terminal)("is disabled and not Confirm in %s", (tag) => {
    // Terminal states are shown by SealPage, but WriteForm must still refuse to
    // press if it were ever rendered in one.
    const html = renderWriteForm({ ...validDraft, state: { tag } as SealState });
    expect(buttonTag(html)).toContain("disabled");
    expect(html).not.toContain(esc(LIVE_COPY.confirmButton));
  });
});
