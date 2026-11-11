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
import { PHONE_QUERY, TopBar, personaNoticeText, topBarShowsNotice } from "./TopBar";
import type { Stage } from "../stages";

/** Every Stage, in the order the reveal reaches them. */
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

/** The Stages after `recall`, where the Compact_Top_Bar shows the note. */
const AFTER_RECALL: Stage[] = ["marks", "seal", "letter", "figures", "close", "error"];

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

  it("renders no notice below 600 px before recall, even with a persona name (PersonaIntro shows it)", () => {
    expect(topBarShowsNotice("Maya", true)).toBe(false);
    expect(topBarShowsNotice("Maya", true, "emerging")).toBe(false);
    expect(topBarShowsNotice("Maya", true, "envelope")).toBe(false);
    expect(topBarShowsNotice("Maya", true, "recall")).toBe(false);
    expect(topBarShowsNotice(undefined, true, "marks")).toBe(false);
  });

  it("renders the notice below 600 px for every Stage after recall (the Compact_Top_Bar)", () => {
    for (const stage of AFTER_RECALL) {
      expect(topBarShowsNotice("Maya", true, stage), stage).toBe(true);
    }
  });

  it("renders the notice at 600 px and wider when given a persona name", () => {
    expect(topBarShowsNotice("Maya", false)).toBe(true);
    expect(topBarShowsNotice(undefined, false)).toBe(false);
    const html = render(createElement(TopBar, { personaName: "Maya" }));
    expect(html).toContain(personaNoticeText("Maya"));
  });

  it("shows the note at both widths in every non-recall Stage, and at 600 px and wider in recall", () => {
    // At 600 px and wider the Top_Bar always shows the note. Below 600 px it
    // shows the note only from `marks` onward, so PersonaIntro carries it
    // before that and the recall Stage keeps its one note, in TestifyContext.
    for (const stage of ALL_STAGES) {
      expect(topBarShowsNotice("Maya", false, stage), `${stage} wide`).toBe(true);
      const html = render(createElement(TopBar, { personaName: "Maya", stage }));
      expect(html, `${stage} markup`).toContain(personaNoticeText("Maya"));
    }
    expect(topBarShowsNotice("Maya", true, "recall")).toBe(false);
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

describe("SceneHeadline (R3.18, F7)", () => {
  it("renders the only h1 with data-scene-ceiling and the text it is given", () => {
    const html = render(createElement(SceneHeadline, { text: "Maya's letter" }));
    expect(html.match(/<h1[^>]*data-scene-ceiling/g)?.length).toBe(1);
    expect(html.match(/<h1/g)?.length).toBe(1);
    expect(html).toContain(">Maya&#x27;s letter</h1>");
  });

  it("shows no Eyebrow and no Tagline", () => {
    const html = render(createElement(SceneHeadline, { text: "The demo letters" }));
    expect(html).not.toContain(BRAND_COPY.eyebrow);
    expect(html).not.toContain("Memory rewrites itself.");
    expect(html).not.toContain("Revenant");
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

describe("Scene headings and check hooks (F7, C1, P2)", () => {
  it("the persona page headline is personaHeading with the persona name, and no Tagline", () => {
    const html = render(
      createElement(
        SceneShell,
        { variant: "persona", personaName: "Maya" } as SceneShellProps,
        createElement("p", null, "body"),
      ),
    );
    const heading = /<h1[^>]*>(.*?)<\/h1>/s.exec(html);
    expect(heading?.[1]).toBe("Maya&#x27;s letter");
    expect(SCENE_COPY.personaHeading.replace("{name}", "Maya")).toBe("Maya's letter");
    expect(html).not.toContain("Memory rewrites itself.");
    expect(html.match(/<h1/g)?.length).toBe(1);
  });

  it("names the Stage content wrapper data-stage-content in the persona copy source", () => {
    const ceremonyRoot = readFileSync(
      resolve(__dirname, "../CeremonyRoot.tsx"),
      "utf8",
    );
    expect(ceremonyRoot).toContain("<div data-stage-content>{children}</div>");
  });

  it("the Pick_Up_Button is retired: EnvelopeView draws no pick-up control (spec 10 C1.3)", () => {
    const envelopeView = readFileSync(
      resolve(__dirname, "../envelope/EnvelopeView.tsx"),
      "utf8",
    );
    expect(envelopeView).not.toContain("onClick={onBegin}");
    expect(envelopeView).not.toContain("REVEAL_COPY.pickUp");
  });

  it("the Persona_Intro keeps its data-block marker", () => {
    const intro = readFileSync(resolve(__dirname, "../intro/PersonaIntro.tsx"), "utf8");
    expect(intro).toContain('data-block="persona-intro"');
  });

  it("the phone headline clamp and text-wrap: balance sit below 600 px", () => {
    const css = readFileSync(resolve(__dirname, "scene.module.css"), "utf8");
    const clampAt = css.indexOf("font-size: clamp(1.55rem, 7.2vw, 1.9rem);");
    const phone = css.slice(css.lastIndexOf("@media (max-width: 599.98px)", clampAt));
    expect(phone).toContain("font-size: clamp(1.55rem, 7.2vw, 1.9rem);");
    expect(phone).toContain("text-wrap: balance;");
  });
});

// --- Top_Bar narrow layout and single Calm (spec 07 task 2) ----------------
//
// Below 600 px the Top_Bar is at most 56 px tall (COMPACT_TOP_BAR_PX), and the
// browser check measures that height. These tests pin the CSS rules that the
// wide layout depends on: at 600 px and wider the notice takes its own full
// row below 900 px, and only the wide layout lets it share a row.

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

  it("does not hide the notice with CSS: TopBar leaves it out below 600 px", () => {
    expect(phoneBlock()).not.toMatch(/\.notice\s*\{/);
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

describe("Top_Bar touch targets (spec 07 control minimum, spec 09 P5 phone hit areas)", () => {
  /** The bodies of every media block below 600 px, in the order they appear. */
  function phoneBlocks(): string[] {
    const blocks: string[] = [];
    const opener = /@media \(max-width: 599\.98px\) \{/g;
    let m: RegExpExecArray | null;
    while ((m = opener.exec(sceneCss)) !== null) {
      const end = sceneCss.indexOf("\n}\n", m.index);
      blocks.push(sceneCss.slice(m.index + m[0].length, end < 0 ? undefined : end));
    }
    return blocks;
  }

  it("keeps the 36 px touch minimum on the base control rule", () => {
    expect(ruleBodyOf(".control")).toMatch(/min-height:\s*36px/);
  });

  it("gives the wordmark link a 44 px hit area in the phone Top_Bar", () => {
    const rules = phoneBlocks()
      .map((block) => block.match(/\n {2}\.wordmarkLink \{([^}]*)\}/)?.[1] ?? "")
      .filter((body) => body !== "");
    expect(rules.length).toBeGreaterThan(0);
    expect(rules[0]).toMatch(/min-height:\s*44px/);
  });

  it("keeps the persona heading nowrap after the text-wrap: balance rule (PH3)", () => {
    // text-wrap: balance resets text-wrap-mode to wrap, so the persona nowrap
    // must be declared in a later block to win the cascade.
    const balanceAt = sceneCss.indexOf("text-wrap: balance;");
    const nowrapAt = sceneCss.lastIndexOf(".personaColumn .headline {\n    white-space: nowrap;");
    expect(balanceAt).toBeGreaterThan(-1);
    expect(nowrapAt).toBeGreaterThan(balanceAt);
  });
});
