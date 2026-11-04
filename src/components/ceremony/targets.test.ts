// Feature: 07-judge-journey, R19.6: pointer target sizes on the Scene pages.
//
// Every pointer target is at least 24 by 24 CSS px. The Pick_Up_Button, the seal,
// "See the numbers" and every close link are at least 44 by 44 CSS px. The check
// reads the module CSS that styles each control, so a later edit that drops a
// minimum fails here. The layout script does not measure targets, so this is
// the guard for the size rule.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { SEAL_HIT_MIN_PX } from "./constants";

const here = dirname(fileURLToPath(import.meta.url));
// src/components/ceremony -> src/components
const componentsRoot = resolve(here, "..");

const read = (rel: string): string => readFileSync(resolve(componentsRoot, rel), "utf8");

/** The body of the first rule whose selector is exactly `.<name>`. */
function declarationsOf(css: string, name: string, file: string): string {
  const match = new RegExp(`(?:^|\\n)\\.${name}\\s*\\{([^}]*)\\}`).exec(css);
  if (match === null) throw new Error(`no rule .${name} in ${file}`);
  return match[1];
}

/** A px value for a declaration, converting rem at 16 px to the root. */
function sizeOf(declarations: string, property: "min-height" | "min-width", file: string): number {
  const match = new RegExp(`${property}:\\s*(\\d+(?:\\.\\d+)?)(px|rem)`).exec(declarations);
  if (match === null) throw new Error(`no ${property} in ${file}`);
  const value = Number(match[1]);
  return match[2] === "rem" ? value * 16 : value;
}

/** Assert a rule sets both dimensions to at least `minPx`. */
function expectBoth(rel: string, className: string, minPx: number): void {
  const css = read(rel);
  const declarations = declarationsOf(css, className, rel);
  expect(sizeOf(declarations, "min-height", `${rel} .${className}`), `${rel} .${className} height`)
    .toBeGreaterThanOrEqual(minPx);
  expect(sizeOf(declarations, "min-width", `${rel} .${className}`), `${rel} .${className} width`)
    .toBeGreaterThanOrEqual(minPx);
}

describe("44 by 44 targets (R19.6)", () => {
  it("the Pick_Up_Button is at least 44 by 44 px", () => {
    expectBoth("ceremony/envelope/EnvelopeView.module.css", "pickUp", 44);
  });

  it("the Break the seal button is at least 44 by 44 px", () => {
    expectBoth("ceremony/seal/SealBreak.module.css", "button", 44);
  });

  it("the See the numbers button is at least 44 by 44 px", () => {
    expectBoth("reveal/reveal.module.css", "button", 44);
  });

  it("the seal's pointer target is at least 44 px (48 px after the 0.8 scale, R10.16)", () => {
    expect(SEAL_HIT_MIN_PX).toBeGreaterThanOrEqual(48);
  });

  it("the close link to Demo 2 is at least 44 px tall", () => {
    const rel = "ceremony/close/close.module.css";
    const declarations = declarationsOf(read(rel), "cta", rel);
    expect(sizeOf(declarations, "min-height", `${rel} .cta`)).toBeGreaterThanOrEqual(44);
  });

  it("the Start over close link is at least 44 px tall", () => {
    const rel = "ceremony/close/close.module.css";
    const declarations = declarationsOf(read(rel), "quietLink", rel);
    expect(sizeOf(declarations, "min-height", `${rel} .quietLink`)).toBeGreaterThanOrEqual(44);
  });
});

describe("24 by 24 minimum for the other Scene controls (R19.6)", () => {
  it("the Calm and Skip controls are at least 24 px tall", () => {
    const rel = "ceremony/ceremony.module.css";
    const declarations = declarationsOf(read(rel), "deskControl", rel);
    expect(sizeOf(declarations, "min-height", `${rel} .deskControl`)).toBeGreaterThanOrEqual(24);
  });
});
