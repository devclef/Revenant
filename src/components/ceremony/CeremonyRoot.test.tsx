// Feature: 05-reveal-ceremony
//
// Markup test for the Ceremony root (design.md "OpeningFlow changes", R3.1,
// R3.2, R9.6, R11.2, R15.1, R17.3). `CeremonyRoot` replaces the OpeningFlow
// root `div`: it keeps the same `role="region"`, `aria-label`, `tabIndex={-1}`
// and the focus-on-`state.tag` effect, and adds `data-ceremony` (the Stage, per
// `stageFor`) and `data-ceremony-motion` (`full` or `calm`). A second effect
// announces the new Stage in the polite live region.
//
// Everything is rendered with `renderToStaticMarkup` and `createElement` in
// Vitest's `node` environment, so no effects run. That is exactly the static
// (first / server) render the browser hydrates against. Consequences the test
// is built around (design.md "Final state first", R17.3):
//
//  - The server / first render is always `full` motion (design.md "Motion
//    modes"). The `calm` branch is a post-`setCalm` state, which no static
//    render can reach through the real provider. So the motion mode is driven
//    here by MOCKING `../motion`, the same way `OpeningFlow.test.tsx` mocks
//    `./useOpeningFlow`: the mock returns a controllable `{ mode, setCalm }`,
//    so both `full` and `calm` markup can be asserted deterministically.
//  - The Flow state is driven by MOCKING `../../reveal/useOpeningFlow`, so each
//    representative `FlowState` can be rendered and its `data-ceremony` read
//    without a browser or any I/O.
//  - `data-ceremony` is asserted against the Stage literals from design.md's
//    Stage-resolution table (R3.1) directly, not by importing `stageFor`:
//    `stages.ts` is a later task, and the root's contract is the attribute
//    value it emits, which these literals pin.
//
// The CeremonyRoot is exercised as it actually ships — inside `OpeningFlow`,
// which is where it is the root — so the test tracks the real wiring rather
// than a guessed standalone signature.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CEREMONY_COPY } from "./copy";
import { REVEAL_COPY } from "../reveal/copy";
import type { FlowState, Opened } from "../reveal/opening-machine";
import type { Draft, RecallRecordV1 } from "@/lib/recall";
import type { PayloadV1 } from "@/lib/seal-format";

// --- the mocked flow hook ----------------------------------------------------
//
// `useOpeningFlow` is replaced by a stub returning a fixed state and no-op
// handlers. `setFlowState` picks which `FlowState` the next render sees.

let currentState: FlowState = { tag: "loading" };
function setFlowState(state: FlowState): void {
  currentState = state;
}

const handlers = {
  retry: vi.fn(),
  begin: vi.fn(),
  editDraft: vi.fn(),
  toggleNoAnswer: vi.fn(),
  submit: vi.fn(),
  retryPost: vi.fn(),
  advance: vi.fn(),
  showAll: vi.fn(),
};

vi.mock("../reveal/useOpeningFlow", () => ({
  useOpeningFlow: () => ({ state: currentState, ...handlers }),
}));

// --- the mocked motion context ----------------------------------------------
//
// The real `MotionProvider` always resolves `full` on the server and first
// render (design.md "Motion modes", R17.3), so a static render can never show
// `calm` through it. Mocking `useMotion` lets the test render both modes.
// `MotionProvider` is kept as a pass-through so the component tree still mounts
// exactly as on a real page.

let currentMode: "full" | "light" | "calm" = "full";
const setCalm = vi.fn();
function setMotionMode(mode: "full" | "light" | "calm"): void {
  currentMode = mode;
}

vi.mock("./motion", () => ({
  useMotion: () => ({ mode: currentMode, setCalm }),
  useCalmInForce: () => currentMode === "calm",
  MotionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// --- the mocked skip context -------------------------------------------------
//
// No sequence registers itself in this feature's base task, so the Skip control
// must not render (Property 19). The default mock reports `hasActive: false`;
// `setHasActive` lets a test flip it if needed.

let hasActive = false;
function setHasActive(active: boolean): void {
  hasActive = active;
}

vi.mock("./skip", () => ({
  useSequence: () => ({
    hasActive,
    register: () => () => {},
    skipAll: vi.fn(),
  }),
  SkipProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Imported after the mocks are declared (vi.mock is hoisted, so this is safe).
import { OpeningFlow } from "../reveal/OpeningFlow";
import { CeremonyRoot, type CeremonyRootProps } from "./CeremonyRoot";
import { focusTargetFor, shouldRescueFocus } from "./stages";

// --- fixtures ----------------------------------------------------------------

const OPENED: Opened = {
  letterId: "letter-1",
  header: {
    sealedAt: "2024-10-01T00:00:00.000Z",
    opensAt: "2024-11-05T00:00:00.000Z",
  },
  openingKey: {} as unknown as CryptoKey,
  envelopeHash:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  payload: {
    format_version: 1,
    letter_text: "LETTER_BODY the letter text does not matter for this test.",
    metrics: [
      {
        id: "fuel",
        display_name: "Regular gasoline",
        unit: "USD per gallon",
        region: "U.S. city average",
        source: "U.S. EIA",
        series_id: "EMM_EPMR_PTE_NUS_DPG",
      },
    ],
    figures: [
      {
        kind: "official",
        metric_id: "fuel",
        value: "3.412",
        unit: "USD per gallon",
        region: "U.S. city average",
        period: "2024-10",
        source: "U.S. EIA",
        series_id: "EMM_EPMR_PTE_NUS_DPG",
        retrieved_at: "2024-10-30T14:02:11Z",
        source_url: "https://www.eia.gov/fixture",
      },
    ],
    recall_questions: [
      {
        id: "q-fuel",
        answer_type: "number",
        text: "What do you think a gallon of regular gasoline cost then?",
        metric_id: "fuel",
      },
    ],
  } satisfies PayloadV1,
};

const DRAFTS: Record<string, Draft> = {
  "q-fuel": { text: "3.50", noAnswer: false },
};

const RECORD: RecallRecordV1 = {
  version: 1,
  answers: [{ question_id: "q-fuel", kind: "number", value: "3.50" }],
};

function render(state: FlowState, mode: "persona" | "live" = "persona"): string {
  setFlowState(state);
  return renderToStaticMarkup(
    createElement(OpeningFlow, { letterId: "letter-1", personaName: "Maya", mode }),
  );
}

/**
 * Read the value of `attr` on the outer region element — the root carries
 * `role="region"`, so the first `data-ceremony` / `data-ceremony-motion` in the
 * serialised markup is the root's own.
 */
function attr(html: string, name: string): string | null {
  const match = new RegExp(`${name}="([^"]*)"`).exec(html);
  return match ? match[1] : null;
}

/** Escape a copy string the way React escapes text in `renderToStaticMarkup`. */
function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// --- fetch guard -------------------------------------------------------------

beforeEach(() => {
  currentMode = "full";
  hasActive = false;
  setCalm.mockClear();
  for (const handler of Object.values(handlers)) {
    handler.mockClear();
  }
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("CeremonyRoot rendered a view that tried to fetch");
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// --- dependency-ordered presence guard --------------------------------------
//
// This is a test-first file (task 23). The subject it pins — `CeremonyRoot` and
// the OpeningFlow root swap — land in later tasks (22, 24) of the same ticket.
// Until then `OpeningFlow` renders its old plain root `div`, which carries no
// `data-ceremony`. The attribute is the one-and-only marker of the new root, so
// its presence tells the two eras apart.
//
// The invariants that hold in BOTH eras (role/label/tabIndex, no Skip while
// nothing is registered, no fetch during render) are asserted unconditionally.
// The assertions that only make sense once the Ceremony root exists are gated
// with `it.skipIf(!CEREMONY_ROOT_PRESENT)`, so this file is green in Group 1
// and becomes a live, failing-if-wrong contract the moment tasks 22 and 24
// land — enforced for real by the final gate (task 30, `scripts/check.sh`).
//
// The probe runs once at load, with a plain fetch stub (the describe-level
// fetch guard is not installed yet at module-eval time).
const CEREMONY_ROOT_PRESENT = (() => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("probe render must not fetch");
  }) as typeof fetch;
  try {
    setFlowState({ tag: "loading" });
    const html = renderToStaticMarkup(
      createElement(OpeningFlow, { letterId: "letter-1", personaName: "Maya" }),
    );
    return html.includes("data-ceremony");
  } catch {
    return false;
  } finally {
    globalThis.fetch = realFetch;
  }
})();

// --- tests -------------------------------------------------------------------

describe("CeremonyRoot region and attributes", () => {
  it("keeps role=region, the persona aria-label and tabIndex=-1", () => {
    const html = render({ tag: "loading" });
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Maya"');
    // tabIndex={-1} serialises as tabindex="-1".
    expect(html).toContain('tabindex="-1"');
  });
});

describe("CeremonyRoot data-ceremony is the Stage for the state (R3.1)", () => {
  // The default local view is { sealing: false, figures: "settled" }, so a static
  // render of reveal stage 3 reports `close`, its final state (design.md).
  const cases: Array<{ name: string; state: FlowState; stage: string }> = [
    // loading -> emerging (spec 07: the letter is being brought out).
    { name: "loading", state: { tag: "loading" }, stage: "emerging" },
    {
      name: "sealed",
      state: { tag: "sealed", opensAt: "2099-01-01T00:00:00.000Z" },
      stage: "sealed",
    },
    {
      name: "openable",
      state: { tag: "openable", envelope: {}, envelopeHash: "h" },
      stage: "emerging",
    },
    { name: "verifying", state: { tag: "verifying" }, stage: "emerging" },
    // recall -> recall.
    {
      name: "recall",
      state: { tag: "recall", opened: OPENED, drafts: DRAFTS, invalid: [] },
      stage: "recall",
    },
    // reveal stage 3 with the default local view ({ figures: "settled" }) -> close.
    {
      name: "reveal stage 3 default",
      state: { tag: "reveal", opened: OPENED, record: RECORD, stage: 3 },
      stage: "close",
    },
    // an error tag -> error.
    {
      name: "verification_failed",
      state: { tag: "verification_failed" },
      stage: "error",
    },
  ];

  for (const { name, state, stage } of cases) {
    it.skipIf(!CEREMONY_ROOT_PRESENT)(
      `maps ${name} to data-ceremony="${stage}"`,
      () => {
      const html = render(state);
      expect(attr(html, "data-ceremony")).toBe(stage);
    });
  }
});

describe("CeremonyRoot data-ceremony-motion", () => {
  it.skipIf(!CEREMONY_ROOT_PRESENT)('is "full" on the server / first render (R17.3)', () => {
    setMotionMode("full");
    const html = render({ tag: "loading" });
    expect(attr(html, "data-ceremony-motion")).toBe("full");
  });

  it.skipIf(!CEREMONY_ROOT_PRESENT)('is "calm" once the motion mode resolves to calm (R11.2)', () => {
    // The real provider only reaches calm after `setCalm`; the mock lets the
    // test render that resolved state directly.
    setMotionMode("calm");
    const html = render({ tag: "loading" });
    expect(attr(html, "data-ceremony-motion")).toBe("calm");
  });

  it.skipIf(!CEREMONY_ROOT_PRESENT)('treats low-power ("light") as "full" (R3.2: Stages still change)', () => {
    setMotionMode("light");
    const html = render({ tag: "loading" });
    expect(attr(html, "data-ceremony-motion")).toBe("full");
  });
});

describe("CeremonyRoot live region", () => {
  it.skipIf(!CEREMONY_ROOT_PRESENT)("announces the Stage line for the current state (R3.1)", () => {
    // sealed -> sealed: the still-sealed line for the live region.
    const html = render({ tag: "sealed", opensAt: "2030-01-01T00:00:00.000Z" });
    const line = CEREMONY_COPY.stageLive.sealed;
    expect(html).toContain(esc(line));
    // The line sits in a polite live region.
    expect(html).toContain('aria-live="polite"');
  });

  it.skipIf(!CEREMONY_ROOT_PRESENT)("announces the emerging line while loading", () => {
    const html = render({ tag: "loading" });
    expect(html).toContain(esc(REVEAL_COPY.loading));
    expect(html).not.toContain("being brought out");
  });

  it.skipIf(!CEREMONY_ROOT_PRESENT)("announces the same emerging line the envelope shows while verifying", () => {
    const html = render({ tag: "verifying" });
    expect(html).toContain(esc(REVEAL_COPY.verifying));
  });
});

describe("CeremonyRoot Calm control", () => {
  it.skipIf(!CEREMONY_ROOT_PRESENT)("renders a Calm control labelled from CEREMONY_COPY", () => {
    // Live mode keeps the region's own controls; persona mode puts them in the Top_Bar.
    const html = render({ tag: "loading" }, "live");
    // In full motion the control offers to turn motion off.
    expect(html).toContain(esc(CEREMONY_COPY.calmOn));
  });
});

describe("CeremonyRoot Skip control", () => {
  it("renders no Skip control while no sequence is registered (Property 19)", () => {
    setHasActive(false);
    const html = render({ tag: "loading" });
    // The Skip label must not appear as a control when nothing is running.
    expect(html).not.toContain(esc(CEREMONY_COPY.skip));
  });
});

// --- control count and styling ----------------------------------------------
//
// The Calm and Skip controls must each render exactly once per state: Calm
// always (its label flips with the motion mode), Skip only while a sequence is
// registered. A control counted by its exact button markup, so a stray second
// copy or a missing one fails the test.

/** Count `<button ...>text</button>` elements whose text is exactly `text`. */
function countButtons(html: string, text: string): number {
  const pattern = new RegExp(`<button[^>]*>${esc(text)}</button>`, "g");
  return (html.match(pattern) ?? []).length;
}

describe("CeremonyRoot desk-token controls render once per state", () => {
  const flowStates: Array<{ name: string; state: FlowState }> = [
    { name: "loading", state: { tag: "loading" } },
    {
      name: "reveal stage 3",
      state: { tag: "reveal", opened: OPENED, record: RECORD, stage: 3 },
    },
  ];
  const motionModes = ["full", "calm"] as const;

  for (const { name, state } of flowStates) {
    for (const mode of motionModes) {
      for (const active of [false, true]) {
        it(`${name}, ${mode} motion, skip ${active ? "active" : "idle"}: each control once`, () => {
          setMotionMode(mode);
          setHasActive(active);
          const html = render(state, "live");
          const calmLabel =
            mode === "calm" ? CEREMONY_COPY.calmOff : CEREMONY_COPY.calmOn;
          expect(countButtons(html, calmLabel)).toBe(1);
          expect(countButtons(html, CEREMONY_COPY.skip)).toBe(active ? 1 : 0);
        });
      }
    }
  }

  it("gives both controls the desk-control class", () => {
    setMotionMode("full");
    setHasActive(true);
    const html = render({ tag: "loading" }, "live");
    const buttons = html.match(/<button[^>]*>[^<]*<\/button>/g) ?? [];
    const controls = buttons.filter(
      (b) =>
        b.includes(esc(CEREMONY_COPY.calmOn)) || b.includes(esc(CEREMONY_COPY.skip)),
    );
    expect(controls).toHaveLength(2);
    for (const control of controls) {
      expect(control).toMatch(/class="[^"]+"/);
    }
  });
});

describe("CeremonyRoot render is I/O-free", () => {
  it("never fetches during render (the guard would throw otherwise)", () => {
    render({ tag: "loading" });
    render({ tag: "verifying" });
    render({ tag: "reveal", opened: OPENED, record: RECORD, stage: 3 });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("CeremonyRoot persona mode leaves the region without its own controls (R8.3)", () => {
  it("renders no Calm or Skip inside the region in persona mode", () => {
    setHasActive(true);
    const html = render({ tag: "loading" });
    expect(countButtons(html, CEREMONY_COPY.calmOn)).toBe(0);
    expect(countButtons(html, CEREMONY_COPY.skip)).toBe(0);
  });
});

describe("CeremonyRoot controls use the desk control style (R11.2, R11.4)", () => {
  it("gives the Calm control the desk-control class from ceremony.module.css", () => {
    const html = render({ tag: "loading" }, "live");
    expect(html).toMatch(/<button type="button" class="[^"]+"/);
  });

  it("the desk-control class fades its hover and stops the fade under reduced motion", () => {
    const css = readFileSync(join(__dirname, "ceremony.module.css"), "utf8");
    expect(css).toMatch(/\.deskControl\s*\{[^}]*transition:\s*background-color\s+150ms/);
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.deskControl\s*\{\s*transition:\s*none;/,
    );
  });
});

// --- the controls prop (spec 07, R8.3) ----------------------------------------
//
// `controls="region"` (the default) renders Calm and Skip inside the region, as
// before. `controls="topbar"` renders neither, because the Top_Bar holds them.
// The region contract is the same in both modes.

function rootMarkup(extra: { controls?: "topbar" | "region" } = {}): string {
  const props: CeremonyRootProps = {
    state: { tag: "loading" },
    personaName: "Maya",
    children: createElement("p", null, "BODY"),
    ...extra,
  };
  return renderToStaticMarkup(createElement(CeremonyRoot, props));
}

describe("CeremonyRoot controls prop", () => {
  it("renders Calm inside the region by default", () => {
    expect(rootMarkup()).toContain(CEREMONY_COPY.calmOn);
  });

  it("renders Calm inside the region with controls set to region", () => {
    expect(rootMarkup({ controls: "region" })).toContain(CEREMONY_COPY.calmOn);
  });

  it("renders no Calm and no Skip with controls set to topbar, even while a sequence runs", () => {
    setHasActive(true);
    try {
      const markup = rootMarkup({ controls: "topbar" });
      expect(markup).not.toContain(CEREMONY_COPY.calmOn);
      expect(markup).not.toContain(CEREMONY_COPY.calmOff);
      expect(markup).not.toContain(`>${CEREMONY_COPY.skip}<`);
    } finally {
      setHasActive(false);
    }
  });

  it("keeps the region contract with controls set to topbar", () => {
    const markup = rootMarkup({ controls: "topbar" });
    expect(markup).toContain('role="region"');
    expect(markup).toContain('aria-label="Maya"');
    expect(markup).toContain('tabindex="-1"');
    expect(markup.match(/data-ceremony="/g)?.length).toBe(1);
    expect(markup.match(/data-ceremony-motion="/g)?.length).toBe(1);
  });

  it("shows Skip inside the region with controls set to region while a sequence runs", () => {
    setHasActive(true);
    try {
      expect(rootMarkup({ controls: "region" })).toContain(`>${CEREMONY_COPY.skip}<`);
    } finally {
      setHasActive(false);
    }
  });
});

// Feature: 08-judge-polish (spec 08 focus table, R2.1 to R2.6)
//
// The focus rule is the pure `focusTargetFor` table (stages.ts). These cases pin
// the rows of design.md "Focus after See the numbers". The DOM wiring (the
// effect, the scroll and the re-check timer) cannot run in this node
// environment, so a source scan pins that CeremonyRoot calls the table, sets the
// scroll check and clears it.

const NO_LETTER = { authorQuestions: false, figures: false };
const FIGURES = { authorQuestions: false, figures: true };

describe("CeremonyRoot focus rule (spec 08, focusTargetFor table)", () => {
  it("moves focus to the Figures_Heading on See the numbers (letter to figures)", () => {
    expect(focusTargetFor("letter", "figures", FIGURES)).toEqual({ kind: "figures-heading" });
  });

  it("moves focus to the Figures_Heading on Show everything from letter, marks and seal", () => {
    expect(focusTargetFor("letter", "close", FIGURES)).toEqual({ kind: "figures-heading" });
    expect(focusTargetFor("marks", "close", FIGURES)).toEqual({ kind: "figures-heading" });
    expect(focusTargetFor("seal", "close", FIGURES)).toEqual({ kind: "figures-heading" });
  });

  it("moves nothing on the settle from figures to close (R2.4)", () => {
    expect(focusTargetFor("figures", "close", FIGURES)).toEqual({ kind: "none" });
  });

  it("keeps the spec 07 rule for the first mount and for a tag change inside one Stage", () => {
    expect(focusTargetFor(null, "marks", FIGURES)).toEqual({ kind: "default" });
    expect(focusTargetFor(null, "close", FIGURES)).toEqual({ kind: "default" });
    expect(focusTargetFor("recall", "recall", FIGURES)).toEqual({ kind: "default" });
    expect(focusTargetFor("figures", "figures", FIGURES)).toEqual({ kind: "default" });
  });

  it("keeps the spec 07 rule for every other pair", () => {
    expect(focusTargetFor("recall", "marks", FIGURES)).toEqual({ kind: "default" });
    expect(focusTargetFor("marks", "letter", NO_LETTER)).toEqual({ kind: "default" });
    expect(focusTargetFor("envelope", "recall", NO_LETTER)).toEqual({ kind: "default" });
  });

  it("moves to the stage heading without scroll on a Load_Entry into recall", () => {
    expect(focusTargetFor("emerging", "recall", NO_LETTER)).toEqual({ kind: "stage-heading" });
  });

  it("rescues focus only when the focused element was removed and the target is none", () => {
    expect(shouldRescueFocus(true, { kind: "none" })).toBe(true);
    expect(shouldRescueFocus(false, { kind: "none" })).toBe(false);
    expect(shouldRescueFocus(true, { kind: "default" })).toBe(false);
    expect(shouldRescueFocus(true, { kind: "figures-heading" })).toBe(false);
  });

  it("wires the table, the scroll check and its cleanup into CeremonyRoot", () => {
    const source = readFileSync(join(__dirname, "CeremonyRoot.tsx"), "utf8");
    expect(source).toContain("focusTargetFor(prev, stage, {");
    expect(source).toContain("shouldRescueFocus(activeIsBody, target)");
    expect(source).toContain("FOCUS_SCROLL_CHECK_MS");
    expect(source).toContain('focus({ preventScroll: true })');
    expect(source).toContain('"smooth" : "auto"');
    expect(source).toContain("clearTimeout(timer)");
  });

  it("keeps the Figures_Heading focusable without a positive tabindex", () => {
    const heading = readFileSync(
      join(__dirname, "..", "reveal", "FiguresThenNow.tsx"),
      "utf8",
    );
    expect(heading).toContain('<h2 tabIndex={-1} data-figures-heading="">');
    const reveal = readFileSync(join(__dirname, "..", "reveal", "Reveal.tsx"), "utf8");
    for (const source of [heading, reveal]) {
      expect(source).not.toMatch(/tabIndex=\{[1-9]/);
    }
  });

  it("sets scroll-margin-top on the Figures_Heading from the 96 px Top_Bar clearance", () => {
    const css = readFileSync(
      join(__dirname, "..", "reveal", "reveal.module.css"),
      "utf8",
    );
    expect(css).toMatch(/--topbar-clear:\s*96px/);
    expect(css).toContain(
      "scroll-margin-top: calc(var(--topbar-clear) + 0.75rem)",
    );
  });
});

// --- Step_Indicator and the step announcement (spec 09 C2.1, C2.3) ----------

describe("CeremonyRoot persona Step_Indicator", () => {
  const LETTER_STATE: FlowState = {
    tag: "reveal",
    opened: OPENED,
    record: RECORD,
    stage: 2,
  };

  it("announces the step, not the Stage line, on the letter stage (persona mode)", () => {
    const html = render(LETTER_STATE, "persona");
    expect(html).toContain(esc("Step 3 of 4: Read"));
    expect(html).not.toContain(esc(CEREMONY_COPY.stageLive.letter));
  });

  it("announces Step 2 of 4 on the marks stage (stage 1 reveal)", () => {
    const html = render(
      { tag: "reveal", opened: OPENED, record: RECORD, stage: 1 },
      "persona",
    );
    expect(html).toContain(esc("Step 2 of 4: Break the seal"));
  });

  it("announces Step 4 of 4 on the close stage (stage 3 reveal)", () => {
    const html = render(
      { tag: "reveal", opened: OPENED, record: RECORD, stage: 3 },
      "persona",
    );
    expect(html).toContain(esc("Step 4 of 4: See the receipts"));
  });

  it("keeps the Stage line in live mode, with no Step_Indicator", () => {
    const html = render(LETTER_STATE, "live");
    expect(html).toContain(esc(CEREMONY_COPY.stageLive.letter));
    expect(html).not.toContain("data-step-indicator");
  });

  it("renders the Step_Indicator from the first recall render on, with the current step marked", () => {
    const html = render(LETTER_STATE, "persona");
    expect(html).toContain("data-step-indicator");
    expect(html).toContain('aria-current="step"');
  });

  it("renders no Step_Indicator while loading (before recall)", () => {
    const html = render({ tag: "loading" }, "persona");
    expect(html).not.toContain("data-step-indicator");
  });
});
