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
import { COMPACT_TOP_BAR_PX, TOUCH_TARGET_MIN_PX } from "../constants";
import { PHONE_QUERY, TopBar, personaNoticeText } from "./TopBar";

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

describe("Compact_Top_Bar below 600 px (spec 09 P5)", () => {
  /** The text of the phone media block (below 600 px), up to its closing brace. */
  function phoneBlock(): string {
    const start = sceneCss.indexOf("@media (max-width: 599.98px)");
    if (start < 0) return "";
    return sceneCss.slice(start, sceneCss.indexOf("\n}\n", start));
  }

  /** The body of the rule for `selector` inside the phone block. */
  function phoneRuleOf(selector: string): string {
    const block = phoneBlock();
    const at = block.indexOf(`\n  ${selector} {`);
    if (at < 0) return "";
    const open = block.indexOf("{", at);
    return block.slice(open + 1, block.indexOf("}", open));
  }

  it("uses the 599.98px breakpoint, the largest width under PHONE_BELOW_PX", () => {
    expect(phoneBlock()).not.toBe("");
    expect(PHONE_QUERY).toBe("(max-width: 599.98px)");
  });

  it("caps the bar at COMPACT_TOP_BAR_PX (56 px) and keeps it on one row", () => {
    const bar = phoneRuleOf(".topbar");
    expect(bar).toMatch(/height:\s*56px/);
    expect(bar).toMatch(/max-height:\s*56px/);
    expect(bar).toMatch(/flex-wrap:\s*nowrap/);
    expect(COMPACT_TOP_BAR_PX).toBe(56);
  });

  it("makes motion and Skip 44 x 44 icon controls", () => {
    const control = phoneRuleOf(".control");
    expect(control).toMatch(/width:\s*44px/);
    expect(control).toMatch(/height:\s*44px/);
    expect(control).toMatch(/min-width:\s*44px/);
    expect(control).toMatch(/min-height:\s*44px/);
    expect(TOUCH_TARGET_MIN_PX).toBe(44);
    expect(phoneRuleOf(".controlIcon")).toMatch(/display:\s*block/);
    expect(phoneRuleOf(".controlLabel")).toMatch(/display:\s*none/);
  });

  it("hides the notice in the bar below 600 px, because PersonaIntro shows it", () => {
    expect(phoneRuleOf(".notice")).toMatch(/display:\s*none/);
  });

  it("hides the icon and shows the label at 600 px and wider", () => {
    expect(ruleBodyOf(".controlIcon")).toMatch(/display:\s*none/);
    expect(ruleBodyOf(".controlLabel")).toBe("");
  });

  it("keeps the Demo chip and the wordmark in the bar below 600 px", () => {
    expect(phoneRuleOf(".chip")).toBe("");
    expect(phoneRuleOf(".wordmark")).toMatch(/font-size:\s*0\.92rem/);
  });

  it("names each icon control with its copy string, as aria-label and title", () => {
    const html = render(createElement(TopBar, { personaName: "Maya" }), "full", true);
    expect(html).toContain(`aria-label="${CEREMONY_COPY.calmOn}"`);
    expect(html).toContain(`title="${CEREMONY_COPY.calmOn}"`);
    expect(html).toContain(`aria-label="${CEREMONY_COPY.skip}"`);
    expect(html).toContain(`title="${CEREMONY_COPY.skip}"`);
  });

  it("renders each icon as hidden decoration inside its control", () => {
    const html = render(createElement(TopBar), "calm", true);
    expect(html).toContain('data-icon="motion"');
    expect(html).toContain('data-icon="skip"');
    expect(html.match(/aria-hidden="true"/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("does not set data-compact in the server markup, so hydration matches", () => {
    expect(render(createElement(TopBar))).not.toContain("data-compact");
  });
});

describe("Top_Bar at 600 px and wider (spec 07 R8.3, R8.4 unchanged)", () => {
  it("keeps the rule that gives the notice its own row below 900 px", () => {
    const base = ruleBodyOf(".notice");
    expect(base).toMatch(/flex-basis:\s*100%/);
    expect(base).toMatch(/order:\s*3/);
  });

  it("lets the notice share the row on the wide layout", () => {
    const wide = sceneCss.slice(sceneCss.indexOf("@media (min-width: 900px)"));
    const notice = wide.match(/\.notice\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(notice).toMatch(/flex-basis:\s*auto/);
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
