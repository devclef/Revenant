// Feature: 05-reveal-ceremony, Task 5 (task 1 of the then-and-now work)
// Markup tests for Counter (design.md "Stamps and counter", R9.3, R10.6, R11.2).
// Rendered with `renderToStaticMarkup` and `createElement`: no DOM library and
// no JSX, matching the other ceremony figure tests.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { COUNTER_ROLL_MS, EASE_STAMP } from "../constants";
import { MotionProvider } from "../motion";
import {
  COUNTER_ROLL_STEPS,
  COUNTER_STRIP_LENGTH,
  Counter,
  rollsOnMount,
  stripDigits,
} from "./Counter";
import styles from "./figures.module.css";

const renderCounter = (value: string): string =>
  renderToStaticMarkup(createElement(MotionProvider, null, createElement(Counter, { value })));

/** Each digit cell's strip, as the list of digits it holds, in order. */
function parseStrips(html: string): number[][] {
  const cells = html.split('data-counter="digit"').slice(1);
  return cells.map((cell) => {
    // Keep the last digit's own closing tag: cut after "</span>", not before it.
    const strip = cell.slice(0, cell.indexOf("</span></span>") + "</span>".length);
    return [...strip.matchAll(/class="[^"]*counterDigit[^"]*">(\d)<\/span>/g)].map((m) =>
      Number(m[1]),
    );
  });
}

/** Each digit cell's strip roll distance and roll duration, as rendered. */
function parseRolls(html: string): Array<{ steps: string | undefined; duration: string | undefined }> {
  const cells = html.split('data-counter="digit"').slice(1);
  return cells.map((cell) => ({
    steps: cell.match(/--counter-steps:([^;"]+)/)?.[1],
    duration: cell.match(/animation-duration:([^;"]+)/)?.[1],
  }));
}

describe("stripDigits: a strip of ten digits that ends on the target (R9.3)", () => {
  it("has ten entries for every target digit", () => {
    for (let target = 0; target <= 9; target++) {
      expect(stripDigits(target)).toHaveLength(10);
    }
  });

  it("ends on the target digit, so it rests there", () => {
    for (let target = 0; target <= 9; target++) {
      const strip = stripDigits(target);
      expect(strip[strip.length - 1]).toBe(target);
    }
  });

  it("holds every digit exactly once", () => {
    for (let target = 0; target <= 9; target++) {
      expect([...stripDigits(target)].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    }
  });

  it("rejects anything that is not a single digit", () => {
    expect(() => stripDigits(10)).toThrow(RangeError);
    expect(() => stripDigits(-1)).toThrow(RangeError);
    expect(() => stripDigits(1.5)).toThrow(RangeError);
  });
});

describe("Counter markup: strip length and resting digit (R9.3)", () => {
  it("gives every digit of the value its own cell with data-counter", () => {
    const html = renderCounter("3.412");
    expect(html.split('data-counter="digit"')).toHaveLength(4 + 1);
  });

  it("builds each strip with the full strip length", () => {
    const strips = parseStrips(renderCounter("3412"));
    expect(strips).toHaveLength(4);
    for (const strip of strips) {
      expect(strip).toHaveLength(COUNTER_STRIP_LENGTH);
    }
  });

  it("rests each strip on its target digit", () => {
    const strips = parseStrips(renderCounter("3412"));
    expect(strips.map((strip) => strip[strip.length - 1])).toEqual([3, 4, 1, 2]);
  });

  it("draws non-digit characters without a strip", () => {
    const html = renderCounter("3.412 USD");
    expect(parseStrips(html)).toHaveLength(4);
    expect(html).toContain(`class="${styles.counterChar}">.</span>`);
  });

  it("keeps the final value as plain text for screen readers", () => {
    const html = renderCounter("3.412");
    expect(html).toContain(`<span class="${styles.srOnly}">3.412</span>`);
  });

  it("hides the digit strips from screen readers", () => {
    const html = renderCounter("3.412");
    expect(html).toContain(`class="${styles.counterFace}" aria-hidden="true"`);
  });
});

describe("Counter roll: every strip moves the same distance (R10.6)", () => {
  it("gives every strip the same roll distance", () => {
    const rolls = parseRolls(renderCounter("3412"));
    expect(rolls).toHaveLength(4);
    for (const roll of rolls) {
      expect(roll.steps).toBe(String(COUNTER_ROLL_STEPS));
    }
  });

  it("rolls every strip for the same duration and easing from constants", () => {
    const html = renderCounter("3412");
    const rolls = parseRolls(html);
    for (const roll of rolls) {
      expect(roll.duration).toBe(`${COUNTER_ROLL_MS}ms`);
    }
    expect(html).toContain(`animation-timing-function:${EASE_STAMP}`);
  });

  it("moves the strip by the number of steps that reach its last digit", () => {
    expect(COUNTER_ROLL_STEPS).toBe(COUNTER_STRIP_LENGTH - 1);
  });

  it("rolls in full motion only", () => {
    expect(rollsOnMount("full")).toBe(true);
    expect(rollsOnMount("light")).toBe(false);
    expect(rollsOnMount("calm")).toBe(false);
  });

  it("carries the roll class in the full-motion render", () => {
    const html = renderCounter("3412");
    expect(html).toContain(styles.roll);
  });
});
