// Feature: 19-real-sealing-stepper, task 5 step 1 (Components 6, Requirement 3.4)
//
// The Date_Picker on the dark Seal_Step surface. The colours are read from
// real-date-picker.module.css, so the contrast check follows the stylesheet.
// The ids, min and the aria link must match the paper render.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { earliestOpeningDate } from "@/lib/seal-format";

import { RealDatePicker } from "./RealDatePicker";

const here = dirname(fileURLToPath(import.meta.url));
const darkCss = readFileSync(resolve(here, "real-date-picker.module.css"), "utf8");

const DESK = "#0b0912";
const WCAG_AA_NORMAL = 4.5;

const NOW = Date.parse("2026-11-06T12:00:00.000Z");
const MIN = earliestOpeningDate(NOW, "Europe/Stockholm");

/** The first declaration block of the rule whose selector is exactly `selector`. */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`(?:^|[\\s},])${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`no rule for ${selector}`);
  return match[1];
}

/** The 6-digit hex colour `color:` declared in a rule body. */
function colourOf(body: string): string {
  const match = body.match(/(?:^|[\s;])color:\s*(#[0-9a-fA-F]{6})\b/);
  if (!match) throw new Error("no hex colour in rule body");
  return match[1].toLowerCase();
}

function channel(hex: string, offset: number): number {
  const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance of a 6-digit sRGB hex colour. */
function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

/** WCAG contrast ratio between two 6-digit hex colours. */
function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function render(surface: "paper" | "dark"): string {
  return renderToStaticMarkup(
    createElement(RealDatePicker, {
      surface,
      value: "2027-05-12",
      min: MIN,
      timeZoneFallback: true,
      problem: "Choose a date.",
      onChange: () => {},
    }),
  );
}

describe("RealDatePicker on the dark surface", () => {
  it.each([
    [".label", "label"],
    [".hint", "hint"],
    [".problem", "problem"],
  ])("%s colour is at least 4.5:1 on the desk colour (%s)", (selector) => {
    const hex = colourOf(ruleBody(darkCss, selector));
    expect(contrast(hex, DESK)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
  });

  it("the chosen-date and UTC lines use the same hint colour as the hint", () => {
    expect(colourOf(ruleBody(darkCss, ".count"))).toBe(colourOf(ruleBody(darkCss, ".hint")));
  });

  it("keeps the input at least 44px tall with the orange focus outline", () => {
    const input = ruleBody(darkCss, ".dateInput");
    expect(input).toMatch(/min-height:\s*44px/);
    expect(input).toMatch(/color-scheme:\s*dark/);
    expect(ruleBody(darkCss, ".dateInput:focus-visible")).toMatch(/outline:\s*3px solid var\(--accent\)/);
  });

  it("keeps the same ids, min and aria link as the paper surface", () => {
    const dark = render("dark");
    const paper = render("paper");
    for (const fragment of [
      'id="real-opens-on"',
      'id="real-opens-on-hint"',
      'id="real-opens-on-chosen"',
      'id="real-opens-on-problem"',
      `min="${MIN}"`,
      'aria-describedby="real-opens-on-hint real-opens-on-chosen real-opens-on-problem"',
      'type="date"',
    ]) {
      expect(dark).toContain(fragment);
      expect(paper).toContain(fragment);
    }
  });

  it("keeps the UTC fallback and the chosen-date line on the dark surface", () => {
    const dark = render("dark");
    expect(dark).toContain("Opens at midnight on 12 May 2027, in your time zone.");
    expect(dark).toContain("midnight UTC");
  });
});
