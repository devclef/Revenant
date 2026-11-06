// Feature: 07-judge-journey
//
// Markup test for the Scene shell (design.md "SceneShell, TopBar and the
// landing page", "SceneBackdrop and the Soil", "Providers and the Top_Bar";
// R2.6, R6.9, R8.1 to R8.6, R19.5, R24.1). Rendered with `renderToStaticMarkup`
// in the node environment, the same way the other ceremony markup tests run.
//
// The motion mode and the Skip registration are controlled through mocks of
// `../motion` and `../skip`, so both the calm and the Skip-visible markup can
// be asserted. The real providers are pass-throughs for the markup.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { BRAND_COPY } from "@/components/brand/copy";
import { CEREMONY_COPY } from "../copy";
import { SCENE_COPY } from "./copy";

let currentMode: "full" | "light" | "calm" = "full";
let skipActive = false;

vi.mock("../motion", () => ({
  useMotion: () => ({ mode: currentMode, setCalm: vi.fn() }),
  MotionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("../skip", () => ({
  useSequence: () => ({
    hasActive: skipActive,
    register: () => () => {},
    skipAll: vi.fn(),
  }),
  SkipProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Imported after the mocks (vi.mock is hoisted, so this is safe).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SceneBackdrop } from "./SceneBackdrop";
import { SceneHeadline, splitTagline } from "./SceneHeadline";
import { SceneShell, type SceneShellProps } from "./SceneShell";
import { SoilStrip } from "./SoilStrip";
import { TopBar, personaNoticeText } from "./TopBar";

function render(element: React.ReactElement, mode: "full" | "calm" = "full", active = false): string {
  currentMode = mode;
  skipActive = active;
  return renderToStaticMarkup(element);
}

const child = createElement("p", null, "CHILD_CONTENT");

/** Renders the shell from typed props (the children key lives in a typed value). */
function shellElement(props: SceneShellProps): React.ReactElement {
  return createElement(SceneShell, props);
}

describe("the persona notice (R8.4)", () => {
  it("fills the persona's name into the notice copy", () => {
    expect(personaNoticeText("Maya")).toBe(
      "Maya is fictional. This letter was prepared later as a demo.",
    );
  });
});

describe("SceneShell root attributes (R2.6)", () => {
  it("puts data-ceremony and data-ceremony-motion on the landing root only", () => {
    const html = render(shellElement({ variant: "landing", children: child }));
    expect(html.match(/data-ceremony="/g)?.length).toBe(1);
    expect(html).toContain('data-ceremony="scene"');
    expect(html).toContain('data-ceremony-motion="full"');
  });

  it("reports calm motion on the landing root when motion is off", () => {
    const html = render(shellElement({ variant: "landing", children: child }), "calm");
    expect(html).toContain('data-ceremony-motion="calm"');
  });

  it("marks the index root data-ceremony=\"index\" (R26.4)", () => {
    const html = render(shellElement({ variant: "index", children: child }));
    expect(html.match(/data-ceremony="/g)?.length).toBe(1);
    expect(html).toContain('data-ceremony="index"');
    expect(html).not.toContain('data-ceremony="scene"');
  });

  it("gives the index variant the Soil backdrop and the Top_Bar, but no Ghost", () => {
    const html = render(shellElement({ variant: "index", children: child }));
    expect(html).toContain("data-soil-strip");
    expect(html).toContain("data-topbar");
    expect(html).not.toContain("data-persona-column");
    expect(html).not.toContain("is fictional");
    expect(html.indexOf("data-soil-strip")).toBeLessThan(html.indexOf("CHILD_CONTENT"));
  });

  it("adds no data-ceremony on the persona root (the Ceremony region carries it)", () => {
    const html = render(
      shellElement({ variant: "persona", personaName: "Maya", children: child }),
    );
    expect(html).not.toContain("data-ceremony");
  });

  it("wraps the page content in main, so the content shares the Top_Bar padding", () => {
    const html = render(shellElement({ variant: "landing", children: child }));
    expect(html).toMatch(/<main[^>]*>.*CHILD_CONTENT.*<\/main>/);
  });
});

describe("TopBar (R8.1 to R8.6)", () => {
  it("shows the wordmark and the Demo chip, with the wordmark marked for QA", () => {
    const html = render(createElement(TopBar));
    expect(html).toContain("data-wordmark");
    expect(html).toContain(SCENE_COPY.wordmark);
    expect(html).toContain(SCENE_COPY.demoChip);
  });

  it("shows the persona notice when given a persona name, and no notice otherwise", () => {
    const withNotice = render(createElement(TopBar, { personaName: "Maya" }));
    expect(withNotice).toContain(personaNoticeText("Maya"));
    const without = render(createElement(TopBar));
    expect(without).not.toContain("is fictional");
  });

  it("shows Calm and no Skip while no sequence is registered", () => {
    const html = render(createElement(TopBar, { personaName: "Maya" }));
    expect(html).toContain(CEREMONY_COPY.calmOn);
    expect(html).not.toContain(`>${CEREMONY_COPY.skip}<`);
  });

  it("shows Skip after Calm while a sequence is registered, as the last control", () => {
    const html = render(createElement(TopBar, { personaName: "Maya" }), "full", true);
    expect(html).toContain(`>${CEREMONY_COPY.skip}<`);
    expect(html.indexOf(CEREMONY_COPY.calmOn)).toBeLessThan(html.indexOf(CEREMONY_COPY.skip));
    expect(html.match(/data-topbar-last="true"/g)?.length).toBe(1);
  });

  it("marks Calm as the last control when no Skip shows", () => {
    const html = render(createElement(TopBar));
    expect(html.match(/data-topbar-last="true"/g)?.length).toBe(1);
  });

  it("renders the notice before Calm and Skip, in document order (R8.3)", () => {
    const html = render(createElement(TopBar, { personaName: "Maya" }), "full", true);
    expect(html.indexOf("is fictional")).toBeLessThan(html.indexOf(CEREMONY_COPY.calmOn));
  });

  it("gives the Calm label the mode it will switch to", () => {
    expect(render(createElement(TopBar), "calm")).toContain(CEREMONY_COPY.calmOff);
    expect(render(createElement(TopBar), "full")).toContain(CEREMONY_COPY.calmOn);
  });
});

describe("SceneBackdrop (R6.9, R19.5)", () => {
  it("renders one aria-hidden container with the light and the Soil strip", () => {
    const html = render(createElement(SceneBackdrop));
    expect(html).toMatch(/aria-hidden="true"/);
    expect(html.match(/aria-hidden="true"/g)?.length).toBe(1);
    expect(html).toContain("data-soil-strip");
  });

  it("renders no canvas, because the Soil_Canvas is a later task", () => {
    const html = render(createElement(SceneBackdrop));
    expect(html).not.toContain("<canvas");
  });

  it("renders its children after the strip, inside the same layer", () => {
    const html = render(createElement(SceneBackdrop, null, child));
    expect(html.indexOf("data-soil-strip")).toBeLessThan(html.indexOf("CHILD_CONTENT"));
  });

  it("renders the Soil_Fallback strip on its own", () => {
    expect(render(createElement(SoilStrip))).toContain("data-soil-strip");
  });
});

describe("SceneHeadline (R3.18, F2)", () => {
  it("renders the only h1 with data-scene-ceiling", () => {
    const html = render(createElement(SceneHeadline));
    expect(html.match(/<h1[^>]*data-scene-ceiling/g)?.length).toBe(1);
    expect(html.match(/<h1/g)?.length).toBe(1);
  });

  it("renders the Eyebrow above the h1, then the Tagline", () => {
    const html = render(createElement(SceneHeadline));
    expect(html.indexOf(BRAND_COPY.eyebrow)).toBeGreaterThanOrEqual(0);
    expect(html.indexOf(BRAND_COPY.eyebrow)).toBeLessThan(html.indexOf("<h1"));
    expect(html).toContain("Memory rewrites itself.");
  });

  it("keeps \"Revenant doesn't.\" together in a nowrap span with no Accent", () => {
    const html = render(createElement(SceneHeadline));
    expect(html).toMatch(/<span class="[^"]*">Revenant\u00a0doesn&#x27;t\.<\/span>/);
    expect(html).not.toContain("receipts.");
  });

  it("splits the Tagline before the kept phrase", () => {
    expect(splitTagline(BRAND_COPY.tagline)).toEqual({
      before: "Memory rewrites itself. ",
      kept: "Revenant\u00a0doesn't.",
    });
  });

  it("returns a tagline without the kept phrase whole", () => {
    expect(splitTagline("Plain line")).toEqual({ before: "Plain line", kept: "" });
  });
});

// --- Top_Bar narrow layout and single Calm (spec 07 task 2) ----------------
//
// The 96 px height at 360 x 640 is measured in the browser check. These tests
// pin the CSS rules that the measurement depends on: the notice takes its own
// full row below 900 px, and only the wide layout lets it share a row.

const sceneCss = readFileSync(resolve(__dirname, "scene.module.css"), "utf8");

/** The body of the first rule with this selector, in the CSS module. */
function ruleBodyOf(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = sceneCss.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  return m?.[1] ?? "";
}

describe("Top_Bar narrow layout (spec 07 task 2)", () => {
  it("gives the notice its own full-width row below 900 px", () => {
    const base = ruleBodyOf(".notice");
    expect(base).toMatch(/flex-basis:\s*100%/);
    expect(base).toMatch(/order:\s*3/);
  });

  it("lets the notice share the row on the wide layout", () => {
    const wide = sceneCss.slice(sceneCss.indexOf("@media (min-width: 900px)"));
    const notice = wide.match(/\.notice\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(notice).toMatch(/flex-basis:\s*auto/);
  });

  it("wraps the bar and keeps the controls at the 36 px touch minimum below 900 px", () => {
    expect(ruleBodyOf(".topbar")).toMatch(/flex-wrap:\s*wrap/);
    expect(ruleBodyOf(".control")).toMatch(/min-height:\s*36px/);
  });

  it("renders one Calm control on the persona page, held by the Top_Bar", () => {
    const html = render(
      shellElement({
        variant: "persona",
        personaName: "Maya",
        children: child,
      }),
    );
    expect(html.split(`>${CEREMONY_COPY.calmOn}<`).length - 1).toBe(1);
  });
});
