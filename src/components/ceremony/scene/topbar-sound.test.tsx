// Feature: 09-demo-polish, task 17 (C4.4, C4.5, P5.2)
//
// Markup tests for the Top_Bar sound toggle and the Top_Bar Skip. The repo runs
// these in the node environment, so the markup comes from renderToStaticMarkup.
// The width split (600 px) is CSS, so the position at each width is checked
// through the rule that applies the Calm look, and the browser check measures
// the real layout.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactNode } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CEREMONY_COPY } from "../copy";
import { SceneShell } from "./SceneShell";
import { TopBar, type TopBarSound } from "./TopBar";

let skipActive = false;

vi.mock("../motion", () => ({
  useMotion: () => ({ mode: "full", setCalm: vi.fn() }),
  MotionProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("../skip", () => ({
  useSequence: () => ({
    hasActive: skipActive,
    register: () => () => {},
    skipAll: vi.fn(),
  }),
  SkipProvider: ({ children }: { children: ReactNode }) => children,
}));

const CALM = CEREMONY_COPY.calmOn; // motion is on, so the Calm control offers to turn it off
const SKIP = CEREMONY_COPY.skip;

function bar(sound: TopBarSound | undefined, active: boolean): string {
  skipActive = active;
  return renderToStaticMarkup(createElement(TopBar, { sound }));
}

const off: TopBarSound = { enabled: false, onChange: () => {} };
const on: TopBarSound = { enabled: true, onChange: () => {} };

const at = (html: string, needle: string): number => html.indexOf(needle);

describe("the Top_Bar sound toggle (C4.4, P5.2)", () => {
  it("sits between Calm and Skip while a sequence runs", () => {
    const html = bar(off, true);
    const calm = at(html, `aria-label="${CALM}"`);
    const sound = at(html, "data-topbar-sound");
    const skip = at(html, `aria-label="${SKIP}"`);
    expect(calm).toBeGreaterThanOrEqual(0);
    expect(sound).toBeGreaterThan(calm);
    expect(skip).toBeGreaterThan(sound);
  });

  it("sits between Calm and the end of the bar when no sequence runs", () => {
    const html = bar(off, false);
    const calm = at(html, `aria-label="${CALM}"`);
    const sound = at(html, "data-topbar-sound");
    expect(sound).toBeGreaterThan(calm);
    expect(html).not.toContain(`aria-label="${SKIP}"`);
  });

  it("is off by default and offers to turn sound on", () => {
    const html = bar(off, false);
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain(`aria-label="${CEREMONY_COPY.soundOn}"`);
    expect(html).toContain(`title="${CEREMONY_COPY.soundOn}"`);
    expect(html).toContain(`>${CEREMONY_COPY.soundOn}</span>`);
  });

  it("reports sound on with aria-pressed true and offers to turn it off", () => {
    const html = bar(on, false);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain(`aria-label="${CEREMONY_COPY.soundOff}"`);
  });

  it("renders no sound control on a page that passes no sound state", () => {
    const html = bar(undefined, false);
    expect(html).not.toContain("data-topbar-sound");
  });

  it("marks the sound control as the last control when Skip is hidden, and moves the mark off Calm", () => {
    const html = bar(off, false);
    expect(html).toMatch(/<button[^>]*data-topbar-sound[^>]*data-topbar-last/);
    expect(html).not.toMatch(new RegExp(`aria-label="${CALM}"[^>]*data-topbar-last`));
  });
});

describe("Top_Bar Skip visibility (C4.5)", () => {
  it("is absent while no sequence runs", () => {
    const html = bar(off, false);
    expect(html).not.toContain(`aria-label="${SKIP}"`);
    expect(html).not.toMatch(/data-topbar-last[^>]*aria-label="Skip"/);
  });

  it("is present while a sequence runs, and is then the last control", () => {
    const html = bar(off, true);
    expect(html).toContain(`aria-label="${SKIP}"`);
    expect(html).toMatch(new RegExp(`data-topbar-last[^>]*aria-label="${SKIP}"`));
    expect(html).not.toMatch(/<button[^>]*data-topbar-sound[^>]*data-topbar-last/);
  });
});

describe("the sound control on the persona page (SceneShell)", () => {
  it("renders the sound control in the persona Top_Bar, between Calm and the content", () => {
    const html = renderToStaticMarkup(
      SceneShell({
        variant: "persona",
        personaName: "Maya",
        children: createElement("p", null, "PERSONA_CONTENT"),
      }),
    );
    const calm = at(html, `aria-label="${CALM}"`);
    const sound = at(html, "data-topbar-sound");
    const content = at(html, "PERSONA_CONTENT");
    expect(calm).toBeGreaterThanOrEqual(0);
    expect(sound).toBeGreaterThan(calm);
    expect(content).toBeGreaterThan(sound);
    expect(html).toContain('aria-pressed="false"');
  });

  it("renders no sound control on the landing page", () => {
    const html = renderToStaticMarkup(
      SceneShell({
        variant: "landing",
        children: createElement("p", null, "LANDING"),
      }),
    );
    expect(html).not.toContain("data-topbar-sound");
  });
});

describe("the sound control keeps the Calm look at both widths (P5.2)", () => {
  const scene = readFileSync(resolve(__dirname, "scene.module.css"), "utf8");
  const soundSource = readFileSync(resolve(__dirname, "..", "sound", "SoundToggle.tsx"), "utf8");

  it("uses the same .control and icon classes as Calm and Skip", () => {
    expect(soundSource).toMatch(/className=\{topbarStyles\.control\}/);
    expect(soundSource).toMatch(/topbarStyles\.controlIcon/);
    expect(soundSource).toMatch(/topbarStyles\.controlLabel/);
  });

  it("the phone block sizes .control to a 44 px icon control, as it does for Calm", () => {
    expect(scene).toMatch(
      /@media \(max-width: 599\.98px\) \{[\s\S]*?\.control \{[\s\S]*?width: 44px;[\s\S]*?height: 44px;/,
    );
  });
});
