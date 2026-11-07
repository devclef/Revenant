// Feature: 09-demo-polish (spec 09 C5.1, C5.2)
//
// The crack on the held Envelope, the Calm and reduced-motion settled state, and
// the 44 by 44 px minimum pointer target. The seal's drawing is one element that
// SealBreak renders either in place or into the held Envelope's slot, so the
// crack overlay that the button draws is the same in both placements. These tests
// read the source and the stylesheets, and render the settled markup, because the
// test environment has no DOM for portals.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SEAL_HIT_MIN_PX } from "../constants";
import { LiveRegionProvider } from "../LiveRegion";
import { MotionProvider } from "../motion";
import { SkipProvider } from "../skip";
import { CRACK_COUNT } from "./cracks";
import { SealBreak, planSealBreak, type SealBreakProps } from "./SealBreak";
import type { SealController } from "./useSealBreak";

const sealSource = readFileSync(join(__dirname, "SealBreak.tsx"), "utf8");
const sealCss = readFileSync(join(__dirname, "SealBreak.module.css"), "utf8");
const sceneCss = readFileSync(
  join(__dirname, "..", "scene", "scene.module.css"),
  "utf8",
);

/** The declarations inside one rule, e.g. `.sealTarget { ... }`. */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`no rule for ${selector}`);
  return match[1];
}

const SETTLED: SealController = {
  hold: { phase: "idle", progress: 0 },
  broken: false,
  progress: 0,
  press: () => undefined,
  breakNow: () => undefined,
  showAll: () => undefined,
  skip: () => undefined,
  connect: () => undefined,
};

const BROKEN: SealController = {
  ...SETTLED,
  hold: { phase: "broken", progress: 1 },
  broken: true,
  progress: 1,
};

const renderSealBreak = (overrides: Partial<SealBreakProps>): string =>
  renderToStaticMarkup(
    createElement(
      SkipProvider,
      null,
      createElement(
        LiveRegionProvider,
        null,
        createElement(
          MotionProvider,
          null,
          createElement(SealBreak, {
            patternKey: "us-maya",
            seal: SETTLED,
            ...overrides,
          }),
        ),
      ),
    ),
  );

describe("the crack trigger on the held Envelope (spec 09 C5.1)", () => {
  it("draws the crack overlay from one element that both placements render", () => {
    // `sealDrawing` holds the pressable seal, the rings and the crack overlay. It
    // appears once for the in-place branch and once in the portal, so the crack
    // is the same whether the seal sits on the Envelope or in the Content_Column.
    const uses = sealSource.match(/\{sealDrawing\}/g) ?? [];
    expect(uses).toHaveLength(2);
  });

  it("portals the seal drawing into the held Envelope's slot when one is mounted", () => {
    expect(sealSource).toMatch(
      /createPortal\(\s*<>\s*<div\s+style=\{TIMING_VARS\}\s+data-broken=\{broken\}\s+data-envelope-seal=""\s*>\s*\{sealDrawing\}/,
    );
    expect(sealSource).toMatch(/envelopeSlot,\s*\)/);
  });

  it("attaches the crack overlay ref to the one overlay the button animates", () => {
    expect(sealSource.match(/ref=\{overlayRef\}/g)).toHaveLength(1);
    expect(sealSource).toMatch(/breakNow\(overlayRef\.current\)/);
  });

  it("starts the crack from the button press, not from a hold, in Calm_Mode too", () => {
    // The button always reaches breakNow; in Calm_Mode the controller breaks at
    // once with no animation (useSealBreak: the calm branch of breakNow).
    expect(sealSource).toMatch(
      /const onButton = \(\) => \{\s*setBreaking\(true\);\s*breakNow\(overlayRef\.current\);/,
    );
  });
});

describe("the calm and reduced-motion settled state (spec 09 C5.1, R11.2)", () => {
  it("plans no motion at all in Calm_Mode", () => {
    expect(planSealBreak({ calm: true }).steps).toEqual([]);
  });

  it("renders a broken seal in Calm_Mode with no flakes and every crack fully drawn", () => {
    const markup = renderSealBreak({ seal: BROKEN, calm: true });
    expect(markup).toContain('data-broken="true"');
    expect(markup).not.toContain("--flake-x");
    expect(markup).not.toContain("--flake-dx");
    const offsets = Array.from(
      markup.matchAll(/<path[^>]*stroke-dashoffset="([^"]+)"/g),
    ).map((m) => Number(m[1]));
    expect(offsets).toHaveLength(CRACK_COUNT);
    for (const offset of offsets) {
      expect(offset).toBe(0);
    }
  });

  it("gates the flakes on full motion in the source, so Calm_Mode never draws them", () => {
    expect(sealSource).toMatch(/\{broken && !calm \? \(/);
  });

  it("stills the flake, flap and letter under Calm_Mode and reduced motion in the stylesheet", () => {
    expect(sealCss).toMatch(
      /:global\(\[data-ceremony-motion="calm"\]\) \.flake,/,
    );
    expect(sealCss).toMatch(
      /:global\(\[data-ceremony-motion="calm"\]\) \.letter,/,
    );
    expect(sealCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.flake,\s*\.flap,\s*\.letter\s*\{\s*animation: none;/,
    );
  });
});

describe("the seal's pointer target is at least 44 by 44 px (spec 09 C5.2)", () => {
  it("sets the in-place target's minimum to 44 px", () => {
    const body = ruleBody(sealCss, ".sealTarget");
    expect(body).toMatch(/min-width: 44px;/);
    expect(body).toMatch(/min-height: 44px;/);
  });

  it("sets the envelope seal's minimum to 44 px", () => {
    const body = ruleBody(sealCss, ".envelopeSeal");
    expect(body).toMatch(/min-width: 44px;/);
    expect(body).toMatch(/min-height: 44px;/);
  });

  it("sets the seal layer on the held Envelope to a 44 px minimum in scene.module.css", () => {
    const body = ruleBody(sceneCss, ".heldEnvelope [data-envelope-seal]");
    expect(body).toMatch(/min-width: 44px;/);
    expect(body).toMatch(/min-height: 44px;/);
  });

  it("keeps the HeldSeal hit box at or above 44 px", () => {
    expect(SEAL_HIT_MIN_PX).toBeGreaterThanOrEqual(44);
  });
});
