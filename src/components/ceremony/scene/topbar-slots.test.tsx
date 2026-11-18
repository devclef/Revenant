// Feature: spec 14 B1 (task 12.2)
//
// Markup tests for the Top_Bar slots (spec 14 B1.1 to B1.4). They render the
// real TopBar and SceneShell with renderToStaticMarkup, in the node environment.
// The motion mode and the Skip registration come from mocks, so the Skip state
// can be set per test.
//
// Covered: slot order on every Stage of a persona page and on /, /demo,
// /demo/live and /how-it-is-sealed; Skip always rendered and disabled while no
// sequence is registered; the persona notice rendered once and never in
// TestifyContext or PersonaIntro; the /l/[id] bar with no Calm, sound or Skip;
// and controls="none" rendering none of them.
//
// The Demo chip and the no-backdrop checks for /how-it-is-sealed belong to
// task 16, so they are not asserted here.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactNode } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CEREMONY_COPY } from "../copy";
import type { Stage } from "../stages";
import { SceneShell, type SceneShellProps } from "./SceneShell";
import { TopBar, personaNoticeText, type TopBarSound } from "./TopBar";

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

/** Every Stage of a persona page, in the order the reveal reaches them. */
const ALL_STAGES: Stage[] = [
  "emerging",
  "sealed",
  "envelope",
  "recall",
  "marks",
  "seal",
  "letter",
  "figures",
  "close",
  "error",
];

const PERSONA = "Maya";
const SOUND: TopBarSound = { enabled: false, onChange: () => {} };
const SKIP = CEREMONY_COPY.skip;

function renderTopBar(
  props: Parameters<typeof TopBar>[0],
  active = false,
): string {
  skipActive = active;
  return renderToStaticMarkup(createElement(TopBar, props));
}

function renderShell(props: SceneShellProps, active = false): string {
  skipActive = active;
  return renderToStaticMarkup(createElement(SceneShell, props));
}

/** The header (the Top_Bar) from a full page markup. */
function headerOf(html: string): string {
  const match = html.match(/<header[\s\S]*?<\/header>/);
  if (!match) throw new Error("no Top_Bar header in the markup");
  return match[0];
}

/** The data-topbar-slot names in the order they appear in the header. */
function slotOrder(header: string): string[] {
  return [...header.matchAll(/data-topbar-slot="([a-z]+)"/g)].map((m) => m[1]);
}

/** The opening tag of the Skip button. */
function skipTag(header: string): string {
  const match = header.match(/<button[^>]*data-topbar-slot="skip"[^>]*>/);
  if (!match) throw new Error("no Skip button in the Top_Bar");
  return match[0];
}

const child = createElement("p", null, "CHILD_CONTENT");

describe("Top_Bar slot order (spec 14 B1.1)", () => {
  it("renders the persona bar in the order wordmark, chip, notice, Calm, sound, Skip on every Stage", () => {
    for (const stage of ALL_STAGES) {
      const header = headerOf(
        renderTopBar({ personaName: PERSONA, stage, sound: SOUND }),
      );
      expect(slotOrder(header), `${stage} order`).toEqual([
        "wordmark",
        "chip",
        "notice",
        "calm",
        "sound",
        "skip",
      ]);
    }
  });

  it("renders the landing bar in the order wordmark, chip, Calm, Skip", () => {
    const header = headerOf(
      renderShell({ variant: "landing", children: child }),
    );
    expect(slotOrder(header)).toEqual(["wordmark", "chip", "calm", "skip"]);
  });

  it("renders the /demo bar in the order wordmark, chip, Calm, Skip", () => {
    const header = headerOf(renderShell({ variant: "index", children: child }));
    expect(slotOrder(header)).toEqual(["wordmark", "chip", "calm", "skip"]);
  });

  it("renders the /demo/live bar in the order wordmark, chip, Calm, Skip", () => {
    const header = headerOf(
      renderShell({
        variant: "plain",
        demo: true,
        backdrop: true,
        children: child,
      }),
    );
    expect(slotOrder(header)).toEqual(["wordmark", "chip", "calm", "skip"]);
  });

  it("renders the /how-it-is-sealed bar in slot order without the chip", () => {
    // Only the slot order and the disabled Skip are checked here (task 16 owns
    // the Demo chip and the no-backdrop checks).
    const header = headerOf(
      renderShell({ variant: "plain", demo: false, children: child }),
    );
    expect(slotOrder(header)).toEqual(["wordmark", "calm", "skip"]);
  });
});

describe("Top_Bar Skip (spec 14 B1.3)", () => {
  it("renders Skip on every persona Stage, disabled while no sequence is registered", () => {
    for (const stage of ALL_STAGES) {
      const header = headerOf(
        renderTopBar({ personaName: PERSONA, stage, sound: SOUND }),
      );
      expect(skipTag(header), `${stage} Skip`).toMatch(/disabled=""/);
      expect(skipTag(header), `${stage} Skip last`).toMatch(
        /data-topbar-last="true"/,
      );
    }
  });

  it("renders Skip enabled while a sequence is registered", () => {
    const header = headerOf(renderTopBar({ personaName: PERSONA }, true));
    expect(skipTag(header)).not.toMatch(/disabled/);
  });

  it("renders Skip disabled on the landing, /demo, /demo/live and /how-it-is-sealed bars", () => {
    const shells: SceneShellProps[] = [
      { variant: "landing", children: child },
      { variant: "index", children: child },
      { variant: "plain", demo: true, backdrop: true, children: child },
      { variant: "plain", demo: false, children: child },
    ];
    for (const props of shells) {
      const header = headerOf(renderShell(props));
      expect(skipTag(header)).toMatch(/disabled=""/);
    }
  });

  it("gives Skip the accessible name from the copy", () => {
    const header = headerOf(renderTopBar({ personaName: PERSONA }));
    expect(skipTag(header)).toContain(`aria-label="${SKIP}"`);
  });
});

describe("the persona notice (spec 14 B1.4)", () => {
  it("renders personaNoticeText exactly once in the Top_Bar on every persona Stage", () => {
    const text = personaNoticeText(PERSONA);
    for (const stage of ALL_STAGES) {
      const html = renderTopBar({ personaName: PERSONA, stage, sound: SOUND });
      expect(html.split(text).length - 1, `${stage} count`).toBe(1);
      expect(headerOf(html), `${stage} inside the header`).toContain(text);
    }
  });

  it("renders the notice exactly once on the whole persona page", () => {
    const html = renderShell({
      variant: "persona",
      personaName: PERSONA,
      children: child,
    });
    expect(html.split(personaNoticeText(PERSONA)).length - 1).toBe(1);
  });

  it("never renders the notice on the landing, /demo or /demo/live bars", () => {
    const shells: SceneShellProps[] = [
      { variant: "landing", children: child },
      { variant: "index", children: child },
      { variant: "plain", demo: true, backdrop: true, children: child },
    ];
    for (const props of shells) {
      const html = renderShell(props);
      expect(html).not.toContain("is fictional");
    }
  });

  it("is not in the TestifyContext or PersonaIntro source", () => {
    // These two components used to show the notice. The Top_Bar owns it now,
    // so neither file may reference the notice copy.
    const dir = resolve(process.cwd(), "src/components/ceremony/intro");
    for (const file of ["TestifyContext.tsx", "PersonaIntro.tsx"]) {
      const source = readFileSync(resolve(dir, file), "utf8");
      expect(source, file).not.toMatch(/personaNotice/);
    }
  });
});

describe('the /l/[id] bar and controls="none" (spec 14 B1)', () => {
  it('renders no Calm, sound or Skip on the letter page (controls="none")', () => {
    const header = headerOf(
      renderShell({
        variant: "plain",
        demo: false,
        controls: "none",
        children: child,
      }),
    );
    expect(header).not.toMatch(/data-topbar-slot="calm"/);
    expect(header).not.toMatch(/data-topbar-slot="sound"/);
    expect(header).not.toMatch(/data-topbar-slot="skip"/);
    expect(header).not.toContain(CEREMONY_COPY.calmOn);
    expect(header).not.toContain(CEREMONY_COPY.calmOff);
    expect(header).not.toContain(CEREMONY_COPY.soundOn);
    expect(header).not.toContain(CEREMONY_COPY.soundOff);
  });

  it("keeps the wordmark on the letter page bar", () => {
    const header = headerOf(
      renderShell({
        variant: "plain",
        demo: false,
        controls: "none",
        children: child,
      }),
    );
    expect(header).toContain("data-wordmark");
    expect(slotOrder(header)).toEqual(["wordmark"]);
  });

  it('renders none of Calm, sound or Skip from TopBar with controls="none"', () => {
    const header = headerOf(
      renderTopBar({ personaName: PERSONA, controls: "none", sound: SOUND }),
    );
    expect(slotOrder(header)).not.toContain("calm");
    expect(slotOrder(header)).not.toContain("sound");
    expect(slotOrder(header)).not.toContain("skip");
    expect(header).not.toContain(`aria-label="${SKIP}"`);
  });
});
