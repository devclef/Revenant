// Markup tests for NumberLine (05-reveal-ceremony, design.md "Number_Line
// geometry", R10.3, R10.4, R11.9, R12.1-R12.4, Properties 11 and 12).
// Rendered with `renderToStaticMarkup` and `createElement`, no JSX.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { POSITION_PROPERTIES } from "../constants";
import { NumberLine, type NumberLineProps } from "./NumberLine";
import styles from "./figures.module.css";

const render = (props: NumberLineProps): string =>
  renderToStaticMarkup(createElement(NumberLine, props));

const base = { thenValue: "10", nowValue: "20", unit: "USD per gallon" };

// Pull every `--name:value` pair out of the rendered style attribute.
const customProperties = (html: string): Array<[string, string]> => {
  const style = html.match(/style="([^"]*)"/)?.[1] ?? "";
  return [...style.matchAll(/(--[a-z-]+):([^;]+)/g)].map(
    (m) => [m[1], m[2]] as [string, string],
  );
};

describe("NumberLine places the Mark from the answer (R12.1, R10.3)", () => {
  it("draws no Mark element when there is no answer", () => {
    const html = render(base);
    expect(html).not.toContain(styles.markWrap);
    expect(html).not.toContain(styles.markStroke);
    expect(html).not.toContain("--pos-mark");
  });

  it("draws the Mark at --pos-mark from the answer", () => {
    // Range for 10 and 20: span 10, pad 2.5, width 15. pos(15) = 0.5.
    const html = render({ ...base, markValue: "15" });
    expect(html).toContain(styles.markWrap);
    expect(html).toContain("--pos-mark:0.5");
  });

  it("gives the pins their own positions from then and now", () => {
    const html = render({ ...base, markValue: "15" });
    expect(html).toContain("--pos-then:0.16666666666666666");
    expect(html).toContain("--pos-now:0.8333333333333334");
  });
});

describe("only the three position variables carry positions (R10.3)", () => {
  it("sets nothing but --pos-then, --pos-now and --pos-mark", () => {
    const names = customProperties(render({ ...base, markValue: "15" })).map(
      ([name]) => name,
    );
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(POSITION_PROPERTIES).toContain(name);
    }
  });

  it("sets no position variable without a Mark", () => {
    const names = customProperties(render(base)).map(([name]) => name);
    expect(names).not.toContain("--pos-mark");
  });
});

describe("the Mark's hidden text and the axis (R11.9, R12.4)", () => {
  it("speaks the typed answer with its unit, unchanged", () => {
    const html = render({ ...base, markValue: "15.50" });
    expect(html).toContain("Your answer: 15.50 USD per gallon");
  });

  it("keeps the axis, pins and stroke hidden from screen readers", () => {
    const html = render({ ...base, markValue: "15" });
    const hidden = html.match(/aria-hidden="true"/g) ?? [];
    expect(hidden.length).toBe(4);
  });

  it("shows no numbers of its own apart from the answer text", () => {
    const html = render(base);
    expect(html).not.toMatch(/>\s*\d/);
  });
});

describe("an out-of-range Mark looks the same at both edges (R12.3, Property 12)", () => {
  it("sits at 0 beyond the low end and at 1 beyond the high end", () => {
    expect(render({ ...base, markValue: "-1000" })).toContain("--pos-mark:0");
    expect(render({ ...base, markValue: "1000" })).toContain("--pos-mark:1");
  });

  it("differs between the two edges only in the position and the value text", () => {
    const low = render({ ...base, markValue: "-1000" });
    const high = render({ ...base, markValue: "1000" });
    const normalise = (html: string): string =>
      html
        .replace(/--pos-mark:[^;"]+/, "--pos-mark:X")
        .replace(/Your answer: [^<]*</, "Your answer: V<");
    expect(normalise(low)).toBe(normalise(high));
  });
});
