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
import { SceneShell, type SceneShellProps } from "./SceneShell";
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
  it("sits after Calm, with the live Skip first in the group, while a sequence runs", () => {
    // Spec 15 R5.1: Skip is the reserved first slot of the button group.
    const html = bar(off, true);
    const calm = at(html, `aria-label="${CALM}"`);
    const sound = at(html, "data-topbar-sound");
    const skip = at(html, `aria-label="${SKIP}"`);
    expect(calm).toBeGreaterThanOrEqual(0);
    expect(sound).toBeGreaterThan(calm);
    expect(skip).toBeLessThan(calm);
  });

  it("sits after Calm while no sequence runs, with no Skip control", () => {
    const html = bar(off, false);
    const calm = at(html, `aria-label="${CALM}"`);
    const sound = at(html, "data-topbar-sound");
    expect(sound).toBeGreaterThan(calm);
    expect(html).not.toContain('data-topbar-slot="skip"');
    expect(html).not.toMatch(/disabled/);
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

  it("carries the last-control mark on the sound toggle, the rightmost control when sound is shown", () => {
    const html = bar(off, false);
    expect(html).toMatch(/data-topbar-sound[^>]*data-topbar-last="true"/);
    expect(html).not.toMatch(/data-topbar-slot="calm"[^>]*data-topbar-last/);
  });
});

describe("Top_Bar Skip visibility (C4.5, spec 15 R5.1)", () => {
  it("is not rendered while no sequence runs, and no control is disabled", () => {
    const html = bar(off, false);
    expect(html).not.toContain('data-topbar-slot="skip"');
    expect(html).not.toMatch(/disabled/);
  });

  it("is present while a sequence runs, and carries no disabled state", () => {
    const html = bar(off, true);
    expect(html).toContain(`aria-label="${SKIP}"`);
    expect(html).not.toMatch(/disabled/);
  });

  it("puts the rightmost-control mark on the sound toggle when sound is shown", () => {
    // Skip is no longer the last control, so the mark moves to the sound
    // toggle, the rightmost control in the group (the layout check reads it).
    const html = bar(off, true);
    expect(html).toMatch(/data-topbar-sound[^>]*data-topbar-last/);
    expect(html).not.toMatch(/data-topbar-slot="skip"[^>]*data-topbar-last/);
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

describe("the sound control on a plain page (spec 09 sound placement)", () => {
  const plain = (sound: boolean | undefined, controls?: "calm" | "none"): string => {
    const props: SceneShellProps = {
      variant: "plain",
      demo: false,
      controls,
      sound,
      children: createElement("p", null, "PLAIN_CONTENT"),
    };
    return renderToStaticMarkup(createElement(SceneShell, props));
  };

  it("renders no sound control on a plain page that does not ask for it", () => {
    expect(plain(undefined)).not.toContain("data-topbar-sound");
  });

  it("renders the sound control after Calm and before the content when the page asks for it", () => {
    const html = plain(true);
    const calm = at(html, 'data-topbar-slot="calm"');
    const sound = at(html, "data-topbar-sound");
    const content = at(html, "PLAIN_CONTENT");
    expect(calm).toBeGreaterThanOrEqual(0);
    expect(sound).toBeGreaterThan(calm);
    expect(content).toBeGreaterThan(sound);
  });

  it("keeps the sound slot reserved and hidden until the Opening_Flow has mounted", () => {
    expect(plain(true)).toMatch(/data-topbar-sound[^>]*visibility:hidden/);
  });

  it("shows the sound slot in the bar on the letter page, where Calm and Skip are off", () => {
    const html = plain(true, "none");
    expect(html).toMatch(/data-topbar-sound/);
    expect(html).not.toMatch(/data-topbar-slot="calm"/);
    expect(html).not.toMatch(/data-topbar-slot="skip"/);
  });

  it("does not hide a sound control that is not reserved", () => {
    const html = bar({ enabled: false, onChange: () => {}, reserved: false }, false);
    expect(html).toContain("data-topbar-sound");
    expect(html).not.toContain("visibility:hidden");
  });

  it("reports the Opening_Flow mount through SoundSlotContext, which the shell listens to", () => {
    const flow = readFileSync(
      resolve(__dirname, "..", "..", "reveal", "OpeningFlow.tsx"),
      "utf8",
    );
    const shell = readFileSync(resolve(__dirname, "SceneShell.tsx"), "utf8");
    expect(flow).toMatch(/useContext\(SoundSlotContext\)/);
    expect(flow).toMatch(/reportSoundSlot\(\)/);
    expect(shell).toMatch(/setSoundSlotReady\(true\)/);
  });

  it("passes sound to the plain Scene on the live demo page and the letter page", () => {
    const live = readFileSync(resolve(__dirname, "..", "..", "..", "app", "demo", "live", "page.tsx"), "utf8");
    const letter = readFileSync(resolve(__dirname, "..", "..", "..", "app", "l", "[id]", "page.tsx"), "utf8");
    expect(live).toMatch(/variant="plain"[^>]*\bsound\b/);
    expect(letter).toMatch(/variant="plain"[^>]*\bsound\b/);
  });
});
