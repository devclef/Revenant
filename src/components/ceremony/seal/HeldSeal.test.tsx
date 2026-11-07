// Feature: 07-judge-journey (task 5)
//
// Tests for HeldSeal, the pointer target on the wax seal (R10.16, R12.11, R19.6).
// It is a plain function component with no hooks, so the tests call it directly
// and read its tree.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SEAL_HIT_MIN_PX } from "../constants";
import { HeldSeal } from "./HeldSeal";
import type { SealController } from "./useSealBreak";

const controller = (press = vi.fn()): SealController => ({
  hold: { phase: "idle", progress: 0 },
  broken: false,
  progress: 0,
  press,
  breakNow: () => undefined,
  showAll: () => undefined,
  skip: () => undefined,
  connect: () => undefined,
});

// The wrapper span is the element HeldSeal returns.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const targetOf = (props: { controller: SealController; children?: unknown }): any =>
  HeldSeal(props as Parameters<typeof HeldSeal>[0]);

describe("HeldSeal markup", () => {
  it("is hidden from assistive tech, outside the tab order, and marked for QA", () => {
    const markup = renderToStaticMarkup(
      createElement(HeldSeal, { controller: controller() }),
    );
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("data-seal-target");
    expect(markup).not.toMatch(/tabindex/i);
    expect(markup).not.toMatch(/role="button"/);
  });

  it("wraps the seal it is given", () => {
    const markup = renderToStaticMarkup(
      createElement(HeldSeal, { controller: controller() }, createElement("i", { id: "seal" })),
    );
    expect(markup).toContain('<i id="seal"></i>');
  });

  it("sets the hit box size from SEAL_HIT_MIN_PX as a custom property", () => {
    const markup = renderToStaticMarkup(
      createElement(HeldSeal, { controller: controller() }),
    );
    expect(markup).toContain(`--seal-hit-min:${SEAL_HIT_MIN_PX}px`);
    expect(SEAL_HIT_MIN_PX).toBeGreaterThanOrEqual(48 / 0.8);
  });
});

describe("HeldSeal pointer handling", () => {
  it("forwards a pointer press to the controller with the target and pointer id", () => {
    const press = vi.fn();
    const target = { id: "target" };
    const el = targetOf({ controller: controller(press) });
    el.props.onPointerDown({ pointerId: 7, currentTarget: target });
    expect(press).toHaveBeenCalledWith(target, 7);
  });
});

describe("HeldSeal stylesheet (touch target and hit box)", () => {
  const css = readFileSync(join(__dirname, "HeldSeal.module.css"), "utf8");

  it("takes touch with touch-action none and blocks text selection", () => {
    expect(css).toMatch(/\.target\s*\{[^}]*touch-action:\s*none/);
    expect(css).toMatch(/\.target\s*\{[^}]*user-select:\s*none/);
  });

  it("gives the ::before hit box at least the minimum size, centred on the seal", () => {
    const before = css.match(/\.target::before\s*\{[^}]*\}/)?.[0] ?? "";
    expect(before).toMatch(/width:\s*max\(100%,\s*var\(--seal-hit-min\)/);
    expect(before).toMatch(/height:\s*max\(100%,\s*var\(--seal-hit-min\)/);
    expect(before).toMatch(/translate\(-50%,\s*-50%\)/);
  });
});
