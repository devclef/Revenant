// Feature: 08-judge-polish, task 2 (issue #190): the marks card record (R6).
//
// RecordedScale is a static view. These tests read its markup and stylesheet.
// They cover what R6 asks for: no slider, no tab stop, no handlers, the default
// cursor, the Mark at the recorded value, "No answer" with no Mark, the
// Unit_Helper_Line, and the R6.5 rule that tick labels never overlap.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { CEREMONY_COPY } from "../copy";
import { MARKS_SCALE_GAP_PX } from "../constants";
import { RecordedScale } from "./RecordedScale";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "RecallScale.module.css"), "utf8");

function render(overrides: Partial<Parameters<typeof RecordedScale>[0]> = {}): string {
  const props = {
    id: "q1",
    name: "Regular gasoline",
    label: "What do you think a gallon of gas cost then?",
    unitLabel: "USD per gallon",
    value: "3.47",
    ...overrides,
  };
  return renderToStaticMarkup(<RecordedScale {...props} />);
}

describe("RecordedScale is a record, not a control (R6.1, R6.2, R6.4)", () => {
  it("has no slider, no tab stop and no input or button", () => {
    const markup = render();
    expect(markup).not.toContain('role="slider"');
    expect(markup).not.toContain("tabindex");
    expect(markup).not.toContain("<input");
    expect(markup).not.toContain("<button");
    expect(markup).not.toContain("aria-valuenow");
  });

  it("has no event handler attributes, because nothing listens for input", () => {
    const markup = render();
    expect(markup).not.toMatch(/\bon[a-z]+=/i);
  });

  it("is announced as one image with the Mark's value and unit", () => {
    const markup = render();
    expect(markup).toContain('role="img"');
    expect(markup).toContain(
      'aria-label="What do you think a gallon of gas cost then?: 3.47 USD per gallon"',
    );
  });

  it("keeps the cursor at default on every part of the record", () => {
    expect(css).toMatch(/\.recorded\s*\{[^}]*cursor:\s*default/);
    expect(css).toMatch(/\.recorded\s*\*\s*\{[^}]*cursor:\s*default/);
    expect(css).not.toMatch(/\.recorded[^{]*\{[^}]*cursor:\s*(grab|grabbing|pointer)/);
  });
});

describe("the Mark and its label (R6.3)", () => {
  it("draws the Mark and the value with its digits kept and the integer part grouped", () => {
    const markup = render({ value: "1585.70", unitLabel: "USD per gallon" });
    expect(markup).toContain("1,585.70");
    expect(markup).not.toContain(">1585.70<");
    expect(markup).toContain("recordedMark");
  });

  it("names the answer with its grouped value in the image label", () => {
    const markup = render({ value: "1000", unitLabel: "USD per gallon" });
    expect(markup).toContain(": 1,000 USD per gallon\"");
  });

  it("shows no Mark and the text No answer when no answer is recorded", () => {
    const markup = render({ value: null });
    expect(markup).toContain(CEREMONY_COPY.lineNoAnswer);
    expect(markup).not.toContain("recordedMark");
    expect(markup).toContain('aria-label="What do you think a gallon of gas cost then?: No answer"');
  });

  it("places a value past the top of the range on the nearer edge", () => {
    const markup = render({ value: "20", unitLabel: "USD per gallon" });
    expect(markup).toContain("--pos-mark:1");
  });
});

describe("the marks card scale: name, box and spacing (spec 09 A9)", () => {
  it("marks the root with data-recorded-scale and shows the metric name above the track", () => {
    const markup = render({ name: "Regular gasoline" });
    expect(markup).toContain('data-recorded-scale=""');
    const nameAt = markup.indexOf("Regular gasoline");
    const trackAt = markup.indexOf('role="img"');
    expect(nameAt).toBeGreaterThan(-1);
    expect(nameAt).toBeLessThan(trackAt);
  });

  it("spaces each scale after the first MARKS_SCALE_GAP_PX below the one above", () => {
    const block = css.match(/\.recorded\s*\+\s*\.recorded\s*\{([^}]*)\}/);
    expect(block).not.toBeNull();
    expect(block?.[1]).toContain(`margin-top: ${MARKS_SCALE_GAP_PX}px`);
  });

  it("keeps the readout and the tick row inside the scale's own box", () => {
    // The readout sits above the track and the ticks below it; the track's
    // margins hold both, so nothing is positioned outside the .recorded box.
    expect(css).toMatch(/\.recordedTrack\s*\{[^}]*margin:\s*1\.75rem\s+0/);
  });
});

describe("the Unit_Helper_Line (R7.8, R7.9)", () => {
  it("shows the helper line under an EUR per 1,000 litres scale, linked by aria-describedby", () => {
    const markup = render({ unitLabel: "EUR per 1,000 litres", value: "1200" });
    expect(markup).toContain(CEREMONY_COPY.unitHelperEurPer1000L);
    expect(markup).toContain('aria-describedby="recall-q1-unit-help"');
    expect(markup).toContain('id="recall-q1-unit-help"');
  });

  it("shows no helper line and no aria-describedby for any other unit", () => {
    const markup = render({ unitLabel: "USD per gallon" });
    expect(markup).not.toContain(CEREMONY_COPY.unitHelperEurPer1000L);
    expect(markup).not.toContain("aria-describedby");
  });

  it("does not match a unit that differs only in case or spacing", () => {
    const markup = render({ unitLabel: "eur per 1,000 litres" });
    expect(markup).not.toContain(CEREMONY_COPY.unitHelperEurPer1000L);
  });
});

describe("tick labels (R6.5)", () => {
  it("draws the first and last tick for the USD range", () => {
    const markup = render({ unitLabel: "USD per gallon" });
    expect(markup).toContain(">0<");
    expect(markup).toContain(">10<");
  });

  it("uses tick labels from visibleTicks, not every tick", () => {
    const markup = render({ unitLabel: "EUR per 1,000 litres", value: null });
    expect(markup).toContain("3,000");
    expect(markup).toContain("data-tick-label");
  });
});

describe("the Unit_Helper_Line sits on its own row under the tick labels", () => {
  it("places the helper line after every tick label, outside the track", () => {
    const markup = render({ unitLabel: "EUR per 1,000 litres", value: "1200" });
    const lastTick = markup.lastIndexOf("data-tick-label=");
    const helper = markup.indexOf(`id="recall-q1-unit-help"`);
    expect(lastTick).toBeGreaterThan(-1);
    expect(helper).toBeGreaterThan(lastTick);
    expect(markup.slice(helper)).not.toContain("data-tick-label");
    expect(markup.slice(helper)).not.toContain("data-tick-labels");
    expect(markup.slice(helper)).toContain(CEREMONY_COPY.unitHelperEurPer1000L);
  });

  it("gives the helper a top margin of at least 1.5rem, clearing the 1.5rem tick row", () => {
    const rule = /\.recordedHelp\s*\{([^}]*)\}/.exec(css);
    expect(rule).not.toBeNull();
    const margin = /margin:\s*([\d.]+)rem/.exec(rule?.[1] ?? "");
    expect(margin).not.toBeNull();
    expect(Number(margin?.[1])).toBeGreaterThanOrEqual(1.5);
  });

  it("applies the helper spacing only where a helper line is shown (US scale unchanged)", () => {
    expect(render({ unitLabel: "EUR per 1,000 litres" })).toContain("recordedHelp");
    expect(render({ unitLabel: "USD per gallon" })).not.toContain("recordedHelp");
  });
});

describe("the recorded readout stays on the paper near the track ends", () => {
  it("anchors a value near the start of the track to that start", () => {
    const markup = render({ unitLabel: "EUR per 1,000 litres", value: "1.90" });
    expect(markup).toContain("recordedReadoutStart");
    expect(markup).not.toContain("recordedReadoutEnd");
  });

  it("anchors a value near the end of the track to that end", () => {
    const markup = render({ unitLabel: "EUR per 1,000 litres", value: "2950" });
    expect(markup).toContain("recordedReadoutEnd");
  });

  it("keeps a mid-track readout centred", () => {
    const markup = render({ unitLabel: "EUR per 1,000 litres", value: "1200" });
    expect(markup).not.toContain("recordedReadoutStart");
    expect(markup).not.toContain("recordedReadoutEnd");
  });

  it("defines both edge rules in the stylesheet", () => {
    expect(css).toMatch(/\.recordedReadoutStart\s*\{[^}]*transform:\s*none/);
    expect(css).toMatch(/\.recordedReadoutEnd\s*\{[^}]*translateX\(-100%\)/);
  });
});
