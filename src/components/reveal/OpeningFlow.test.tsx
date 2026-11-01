import { createElement } from "react";
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { REVEAL_COPY } from "./copy";
import { DEMO_COPY } from "@/components/demo/copy";
import type {
  FlowState,
  Opened,
  OpenFailedKind,
} from "./opening-machine";
import type { RecallRecordV1, Draft } from "@/lib/recall";
import type { PayloadV1 } from "@/lib/seal-format";

/**
 * Markup tests for the Opening_Flow view selector (R7.5-R7.9, R16.4, R9.x).
 * Rendered with `renderToStaticMarkup` and `createElement` — no DOM library and
 * no JSX.
 *
 * `OpeningFlow` calls `useOpeningFlow` once and renders exactly one view for the
 * current `state.tag`. Effects do not run during static render, so the real
 * hook would be pinned at `loading`. To render every view, the hook is MOCKED
 * here: `setState(state)` fixes which `FlowState` the selector sees, so each
 * tag's view can be rendered and scanned without a browser or any I/O.
 *
 * The root of `OpeningFlow` is the Ceremony root (design.md "OpeningFlow
 * changes", R3.1, R3.2, R17.3). It keeps the same `role="region"`,
 * `aria-label` and `tabIndex={-1}` as the old plain root `div` and adds
 * `data-ceremony` (the Stage) and `data-ceremony-motion` (`full` or `calm`).
 * Because the root now mounts the motion and skip providers, this file mocks
 * `@/components/ceremony/motion` and `@/components/ceremony/skip` the same way
 * `CeremonyRoot.test.tsx` does, so the static render is deterministic. Those
 * mocks are pass-throughs that also make the server/first render's motion mode
 * controllable; without the swap (before task 24) they are simply unused.
 *
 * A fetch guard fails any call to `global.fetch`: the selector must never fetch
 * (the real hook's effects, which do fetch, are stubbed out), so a render that
 * reaches the network is a defect.
 *
 * These tests enforce the non-negotiable gates:
 * - a failed/verification-failed open renders no letter text, question or
 *   figure (R16.4, R7.6-R7.9);
 * - `submit_failed` shows the retry control and no reveal (R16.4);
 * - the reveal's first stage shows what was remembered and nothing from inside
 *   the letter;
 * - an unknown state renders safely (nothing, no throw).
 */

// --- the mock hook -----------------------------------------------------------
//
// `useOpeningFlow` is replaced by a stub that returns a fixed state and no-op
// handlers. `setState` picks the state the next render will see. The import of
// `OpeningFlow` below binds to this mock.
//
// The stub also records the `letterId` it was called with, so a test can prove
// the optional `persona` prop never changes which letter id reaches the hook.

let currentState: FlowState = { tag: "loading" };
function setState(state: FlowState): void {
  currentState = state;
}

let lastLetterId: string | null = null;

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

vi.mock("./useOpeningFlow", () => ({
  useOpeningFlow: (letterId: string) => {
    lastLetterId = letterId;
    return { state: currentState, ...handlers };
  },
}));

// --- the mocked ceremony providers ------------------------------------------
//
// Once the root is the Ceremony root (task 24), `OpeningFlow` mounts the motion
// and skip providers. The real `MotionProvider` always resolves `full` on the
// server/first render (R17.3), so a static render can never reach `calm`
// through it; mocking `useMotion` lets the test render both modes. The
// providers are kept as pass-throughs so the tree mounts exactly as on a real
// page. Before the swap lands these mocks are unused and harmless.

let currentMode: "full" | "light" | "calm" = "full";
const setCalm = vi.fn();
function setMotionMode(mode: "full" | "light" | "calm"): void {
  currentMode = mode;
}

vi.mock("@/components/ceremony/motion", () => ({
  useMotion: () => ({ mode: currentMode, setCalm }),
  MotionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// No sequence registers in this feature's base task, so the Skip control never
// renders here (Property 19). The mock reports `hasActive: false`.
const hasActive = false;

vi.mock("@/components/ceremony/skip", () => ({
  useSequence: () => ({
    hasActive,
    register: () => () => {},
    skipAll: vi.fn(),
  }),
  SkipProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Imported after the mocks are declared (vi.mock is hoisted, so this is safe).
import { OpeningFlow } from "./OpeningFlow";

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
    letter_text: "LETTER_BODY_SECRET the letter text must never appear here.",
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

/** Strings from inside the letter that no pre-reveal view may ever render. */
const SEALED_PAYLOAD_STRINGS = [
  OPENED.payload.letter_text,
  "3.412", // the sealed figure value
  "2024-10", // the figure's period
  "U.S. EIA", // the figure's source
  "EMM_EPMR_PTE_NUS_DPG", // the series id
  "https://www.eia.gov/fixture", // the source url
];

function render(state: FlowState): string {
  setState(state);
  return renderToStaticMarkup(
    createElement(OpeningFlow, { letterId: "letter-1", personaName: "Maya" }),
  );
}

/**
 * Escape a copy string the way React escapes text content in
 * `renderToStaticMarkup`, so an assertion on a string containing `'`, `"`, `&`,
 * `<` or `>` matches the serialised HTML (e.g. "hasn't" -> "hasn&#x27;t").
 */
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
  lastLetterId = null;
  setCalm.mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("OpeningFlow rendered a view that tried to fetch");
    }),
  );
  for (const handler of Object.values(handlers)) {
    handler.mockClear();
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// --- Ceremony-root presence probe -------------------------------------------
//
// The root swap (task 24) replaces the old plain `div` root — which carried no
// `data-ceremony` — with the Ceremony root, which does. The attribute is the
// one-and-only marker of the new root, so its presence tells the two eras
// apart. Invariants that hold in BOTH eras (role/label/tabIndex, the one view
// per tag, no leak of sealed content, no fetch) are asserted unconditionally.
// The assertions that only make sense once the Ceremony root exists are gated
// with `it.skipIf(!CEREMONY_ROOT_PRESENT)`, so this file is green before task
// 24 and becomes a live, failing-if-wrong contract the moment it lands —
// enforced by the final gate (task 30, `scripts/check.sh`).
//
// The probe runs once at load, with a plain fetch stub (the describe-level
// fetch guard is not installed yet at module-eval time).
const CEREMONY_ROOT_PRESENT = (() => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("probe render must not fetch");
  }) as typeof fetch;
  try {
    setState({ tag: "loading" });
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

/** Read the first value of `attr` in the markup (the root region's own). */
function attr(html: string, name: string): string | null {
  const match = new RegExp(`${name}="([^"]*)"`).exec(html);
  return match ? match[1] : null;
}

// --- tests -------------------------------------------------------------------

describe("OpeningFlow view selection", () => {
  it("wraps the view in a labelled focus region named for the persona", () => {
    const html = render({ tag: "loading" });
    expect(html).toContain('aria-label="Maya"');
    expect(html).toContain('role="region"');
    // The focus target is a -1 tab stop in both eras (R9.6).
    expect(html).toContain('tabindex="-1"');
  });

  it("shows the breaking-the-seal statement while loading", () => {
    const html = render({ tag: "loading" });
    expect(html).toContain(REVEAL_COPY.loading);
  });

  it("shows StillSealed for the sealed state (date, no contents)", () => {
    const html = render({
      tag: "sealed",
      opensAt: "2024-11-05T00:00:00.000Z",
    });
    expect(html).toContain(REVEAL_COPY.sealedTitle);
  });

  it("shows the checking-the-seal statement for openable and verifying", () => {
    expect(
      render({ tag: "openable", envelope: {}, envelopeHash: "h" }),
    ).toContain(REVEAL_COPY.verifying);
    expect(render({ tag: "verifying" })).toContain(REVEAL_COPY.verifying);
  });

  it("shows SealIntact (the statement + Begin) for verified, with no sealed content (R7.5)", () => {
    const html = render({ tag: "verified", opened: OPENED });
    expect(html).toContain(REVEAL_COPY.sealIntact);
    expect(html).toContain(REVEAL_COPY.begin);
    for (const needle of SEALED_PAYLOAD_STRINGS) {
      expect(html, `verified must not leak "${needle}"`).not.toContain(needle);
    }
  });

  it("shows RecallStep for recall, with the question but no sealed figure (R16.4)", () => {
    const html = render({
      tag: "recall",
      opened: OPENED,
      drafts: DRAFTS,
      invalid: [],
    });
    expect(html).toContain(REVEAL_COPY.recallTitle);
    expect(html).toContain(OPENED.payload.recall_questions[0].text);
    for (const needle of SEALED_PAYLOAD_STRINGS) {
      expect(html, `recall must not leak "${needle}"`).not.toContain(needle);
    }
  });

  it("shows RecallStep with the submit control disabled while submitting", () => {
    const html = render({
      tag: "submitting",
      opened: OPENED,
      drafts: DRAFTS,
      record: RECORD,
      sealed: { ciphertext: "c", nonce: "n" },
    });
    expect(html).toContain(REVEAL_COPY.submitting);
    expect(html).toContain("disabled");
    // Still before the reveal: nothing from inside the letter.
    for (const needle of SEALED_PAYLOAD_STRINGS) {
      expect(html, `submitting must not leak "${needle}"`).not.toContain(
        needle,
      );
    }
    // The sealed bytes being posted must never be rendered either.
    expect(html).not.toContain("ciphertext");
  });

  it("shows the retry control and NO reveal for submit_failed (R16.4, R8.7)", () => {
    const html = render({
      tag: "submit_failed",
      opened: OPENED,
      drafts: DRAFTS,
      record: RECORD,
      sealed: { ciphertext: "c", nonce: "n" },
    });
    // The submit-failed notice and the form (its submit control retries).
    expect(html).toContain(esc(REVEAL_COPY.submitFailed));
    expect(html).toContain("<form");
    expect(html).toContain(REVEAL_COPY.submit);
    // No reveal has happened: stage 1's heading and the letter are both absent.
    expect(html).not.toContain(REVEAL_COPY.stage1Title);
    for (const needle of SEALED_PAYLOAD_STRINGS) {
      expect(html, `submit_failed must not leak "${needle}"`).not.toContain(
        needle,
      );
    }
  });

  it("shows the reveal stage 1 (what was remembered) and no letter or figure yet", () => {
    const html = render({
      tag: "reveal",
      opened: OPENED,
      record: RECORD,
      stage: 1,
    });
    expect(html).toContain(REVEAL_COPY.stage1Title);
    expect(html).toContain(`${REVEAL_COPY.yourAnswer}: 3.50`);
    // Stages 2 (letter) and 3 (figures) are filled by a later task: the letter
    // text and the sealed figure must not appear at stage 1.
    for (const needle of SEALED_PAYLOAD_STRINGS) {
      expect(html, `reveal stage 1 must not leak "${needle}"`).not.toContain(
        needle,
      );
    }
  });

  it("maps each open_failed kind to its own error copy, with no payload", () => {
    const kinds: Record<OpenFailedKind, string> = {
      wrong_key: REVEAL_COPY.wrongKey,
      tampered: REVEAL_COPY.tampered,
      unsupported_format: REVEAL_COPY.unsupportedFormat,
      invalid_payload: REVEAL_COPY.invalidPayload,
      invalid_input: REVEAL_COPY.invalidInput,
    };
    for (const [kind, message] of Object.entries(kinds) as [
      OpenFailedKind,
      string,
    ][]) {
      const html = render({ tag: "open_failed", kind });
      expect(html, `${kind} shows its copy`).toContain(esc(message));
      expect(html).toContain(DEMO_COPY.backToDemo);
      for (const needle of SEALED_PAYLOAD_STRINGS) {
        expect(html, `${kind} must not leak "${needle}"`).not.toContain(needle);
      }
    }
  });

  it("renders verification_failed with no letter text, question or figure (R16.4)", () => {
    const html = render({ tag: "verification_failed" });
    expect(html).toContain(esc(REVEAL_COPY.verificationFailed));
    // None of the sealed payload, and not even a recall question, is shown.
    for (const needle of SEALED_PAYLOAD_STRINGS) {
      expect(
        html,
        `verification_failed must not leak "${needle}"`,
      ).not.toContain(needle);
    }
    expect(html).not.toContain(OPENED.payload.recall_questions[0].text);
  });

  it("shows the not_placed and unreachable errors", () => {
    expect(render({ tag: "not_placed" })).toContain(esc(REVEAL_COPY.notPlaced));

    const unreachable = render({ tag: "unreachable" });
    expect(unreachable).toContain(REVEAL_COPY.unreachable);
    // unreachable is transient, so it offers retry.
    expect(unreachable).toContain(REVEAL_COPY.retry);
  });

  it("renders safely for an unknown state (nothing, no throw)", () => {
    // A tag outside the FlowState union must not throw and must render no view.
    const unknown = { tag: "nonsense-tag" } as unknown as FlowState;
    let html = "";
    expect(() => {
      html = render(unknown);
    }).not.toThrow();
    // The wrapper region still renders; its view slot is empty.
    expect(html).toContain('role="region"');
    for (const needle of SEALED_PAYLOAD_STRINGS) {
      expect(html).not.toContain(needle);
    }
  });

  it("never fetches during render (the guard would throw otherwise)", () => {
    // Render one view of each broad category; the beforeEach guard fails any
    // fetch. Reaching here without a throw proves the selector is I/O-free.
    render({ tag: "loading" });
    render({ tag: "verified", opened: OPENED });
    render({ tag: "reveal", opened: OPENED, record: RECORD, stage: 1 });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("OpeningFlow passes the letter id through unchanged", () => {
  it("uses the given letterId for the flow hook", () => {
    render({ tag: "loading" });
    expect(lastLetterId).toBe("letter-1");
  });

  it("does not change the letterId when the optional persona prop is passed", () => {
    // The persona prop (task 24) only feeds the scene/label — it must never
    // alter which letter id the flow hook, and so every API call, uses.
    setState({ tag: "loading" });
    const persona = {
      key: "us-maya",
      display_name: "Maya",
      region: "US",
      written_as_of: "2024-10-30",
      opens_at: "2024-11-05T00:00:00.000Z",
      letter_id: "persona-letter-should-not-be-used",
    };
    renderToStaticMarkup(
      createElement(OpeningFlow, {
        letterId: "letter-1",
        personaName: "Maya",
        // `persona` is optional and only added once task 24 widens the props;
        // an extra prop is harmless to render before then. The cast widens the
        // current prop type with the optional field so this stays green against
        // both the pre-swap and post-swap `OpeningFlowProps`.
        persona,
      } as ComponentProps<typeof OpeningFlow> & { persona: typeof persona }),
    );
    // The hook still received the explicit letterId, never the persona's own id.
    expect(lastLetterId).toBe("letter-1");
    expect(lastLetterId).not.toBe(persona.letter_id);
  });
});

describe("OpeningFlow Ceremony root attributes (R3.1, R3.2, R17.3)", () => {
  it.skipIf(!CEREMONY_ROOT_PRESENT)(
    "carries data-ceremony (the Stage) alongside the region role",
    () => {
      const html = render({ tag: "loading" });
      expect(html).toContain('role="region"');
      // loading resolves to the envelope Stage (design.md Stage-resolution).
      expect(attr(html, "data-ceremony")).toBe("envelope");
    },
  );

  it.skipIf(!CEREMONY_ROOT_PRESENT)(
    "reports data-ceremony-motion as full on the server / first render (R17.3)",
    () => {
      setMotionMode("full");
      const html = render({ tag: "loading" });
      expect(attr(html, "data-ceremony-motion")).toBe("full");
    },
  );

  it.skipIf(!CEREMONY_ROOT_PRESENT)(
    "reports data-ceremony-motion as calm once motion resolves to calm (R11.2)",
    () => {
      setMotionMode("calm");
      const html = render({ tag: "loading" });
      expect(attr(html, "data-ceremony-motion")).toBe("calm");
    },
  );

  it.skipIf(!CEREMONY_ROOT_PRESENT)(
    "keeps the full set of view-per-tag assertions true under the Ceremony root",
    () => {
      // The Stage changes but the view inside each state is unchanged: a few
      // representative tags still render their own view's copy.
      expect(render({ tag: "verified", opened: OPENED })).toContain(
        REVEAL_COPY.sealIntact,
      );
      expect(
        render({ tag: "recall", opened: OPENED, drafts: DRAFTS, invalid: [] }),
      ).toContain(OPENED.payload.recall_questions[0].text);
      expect(
        render({ tag: "reveal", opened: OPENED, record: RECORD, stage: 1 }),
      ).toContain(REVEAL_COPY.stage1Title);
    },
  );
});
