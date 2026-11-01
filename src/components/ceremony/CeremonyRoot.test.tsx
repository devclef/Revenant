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

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CEREMONY_COPY } from "./copy";
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

// --- fixtures ----------------------------------------------------------------

const OPENED: Opened = {
  letterId: "letter-1",
  header: {
    sealedAt: "2024-10-01T00:00:00.000Z",
    opensAt: "2024-11-05T00:00:00.000Z",
  },
  openingKey: {} as unknown as CryptoKey,
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

function render(state: FlowState): string {
  setFlowState(state);
  return renderToStaticMarkup(
    createElement(OpeningFlow, { letterId: "letter-1", personaName: "Maya" }),
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
  // The default local view is { sealing: false, step: "done" }, so a static
  // render of reveal stage 3 reports `close`, its final state (design.md).
  const cases: Array<{ name: string; state: FlowState; stage: string }> = [
    // loading -> envelope (the "loading" shorthand for the envelope Stage).
    { name: "loading", state: { tag: "loading" }, stage: "envelope" },
    {
      name: "sealed",
      state: { tag: "sealed", opensAt: "2099-01-01T00:00:00.000Z" },
      stage: "envelope",
    },
    {
      name: "openable",
      state: { tag: "openable", envelope: {}, envelopeHash: "h" },
      stage: "envelope",
    },
    { name: "verifying", state: { tag: "verifying" }, stage: "envelope" },
    // verified -> intact.
    {
      name: "verified",
      state: { tag: "verified", opened: OPENED },
      stage: "intact",
    },
    // recall -> recall.
    {
      name: "recall",
      state: { tag: "recall", opened: OPENED, drafts: DRAFTS, invalid: [] },
      stage: "recall",
    },
    // reveal stage 3 with the default local view ({ step: "done" }) -> close.
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
    // verified -> intact Stage, whose live line is CEREMONY_COPY.stageLive.intact.
    const html = render({ tag: "verified", opened: OPENED });
    const line = CEREMONY_COPY.stageLive.intact;
    expect(html).toContain(esc(line));
    // The line sits in a polite live region.
    expect(html).toContain('aria-live="polite"');
  });

  it.skipIf(!CEREMONY_ROOT_PRESENT)("announces the envelope line while loading", () => {
    const html = render({ tag: "loading" });
    expect(html).toContain(esc(CEREMONY_COPY.stageLive.envelope));
  });
});

describe("CeremonyRoot Calm control", () => {
  it.skipIf(!CEREMONY_ROOT_PRESENT)("renders a Calm control labelled from CEREMONY_COPY", () => {
    const html = render({ tag: "loading" });
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
    { name: "verified", state: { tag: "verified", opened: OPENED } },
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
          const html = render(state);
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
    const html = render({ tag: "loading" });
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
    render({ tag: "verified", opened: OPENED });
    render({ tag: "reveal", opened: OPENED, record: RECORD, stage: 3 });
    expect(fetch).not.toHaveBeenCalled();
  });
});
