import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { realLetterSealApi, realSealApi, REAL_PREPARE_PATH, REAL_SEAL_PATH, PREPARE_PATH } from "./api";
import { LIVE_COPY, REAL_COPY } from "./copy";
import { DESK_COPY } from "./desk/copy";
import { DEMO_COPY } from "@/components/demo/copy";
import { figuresResponseFrom } from "@/components/reveal/figures-stub";
import { displayFigureValue } from "@/components/reveal/display-figure";
import { DEMO_FIGURES } from "@/lib/figures/demo";
import { sealReducer, INITIAL_SEAL_STATE, type SealEvent, type SealState } from "./seal-machine";

vi.mock("./useSealFlow", () => ({
  useSealFlow: () => ({
    state: { tag: "write" } satisfies SealState,
    onCreatePress: () => {},
    onConfirmPress: () => {},
    onFallbackStart: () => {},
    onFallbackSealPress: () => {},
    onFallbackDecline: () => {},
    onRetry: () => {},
    getBackupKeyText: () => null,
  }),
}));

vi.mock("./useCryptoModule", () => ({
  useCryptoModule: () => null,
}));

// Show the PRF_Hint so the Write step renders it (R16.1).
vi.mock("./prf-hint", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./prf-hint")>()),
  usePrfHint: () => "missing",
}));

// The figures response and the stepper step are set per test. Left null, the
// page behaves as before: no response yet, and the real stepper on Write.
const pageStub = vi.hoisted(() => ({
  figures: null as import("@/components/reveal/figures-api").FiguresState | null,
  step: null as null | import("./stepper/live-steps").LiveStep,
}));

vi.mock("@/components/reveal/figures-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/reveal/figures-api")>()),
  useFigures: () => pageStub.figures ?? { status: "loading" },
}));

vi.mock("./stepper/LiveStepper", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./stepper/LiveStepper")>();
  return {
    ...actual,
    LiveStepper: (props: import("./stepper/LiveStepper").LiveStepperProps) => {
      if (pageStub.step === null) return actual.LiveStepper(props);
      // Show one step directly, so the picker renders in SSR (no clicks here).
      return props.renderStep({
        step: pageStub.step,
        draft: props.state.draft,
        dispatchDraft: () => {},
        next: () => {},
        back: () => {},
        canGoBack: false,
        advanceTo: () => {},
        host: null,
      } as import("./stepper/LiveStepper").StepView);
    },
  };
});

import { SealPage, sealApiFor } from "./SealPage";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sealApiFor (the API each mode posts to)", () => {
  it("uses the Live_Letter routes in demo mode, the default", () => {
    expect(sealApiFor("demo")).toBe(realSealApi);
  });

  it("uses the Real_Letter routes in real mode", () => {
    expect(sealApiFor("real")).toBe(realLetterSealApi);
  });

  it("an injected api wins over the mode", () => {
    const injected = { prepare: vi.fn(), seal: vi.fn() };
    expect(sealApiFor("real", injected)).toBe(injected);
    expect(sealApiFor("demo", injected)).toBe(injected);
  });

  it("real mode posts to /api/letters/prepare and /api/letters/seal, never to a demo route", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await realLetterSealApi.prepare();
    await realLetterSealApi.seal({
      letterId: "L",
      envelope: {},
      envelopeHash: "h",
    });

    const urls = fetchMock.mock.calls.map((call) => call[0]);
    expect(urls).toEqual([REAL_PREPARE_PATH, REAL_SEAL_PATH]);
    expect(urls.some((url) => String(url).includes("/demo/"))).toBe(false);
    expect(REAL_PREPARE_PATH).not.toBe(PREPARE_PATH);
  });
});

describe("SealPage in real mode", () => {
  it("shows the PRF_Hint on the Write step", () => {
    const html = renderToStaticMarkup(
      createElement(SealPage, {
        rpId: "revenant.devclef.se",
        appOrigin: "https://revenant.devclef.se",
        mode: "real",
      }),
    );
    expect(html).toContain(LIVE_COPY.prfHint);
    expect(html).toContain('data-seal-mode="real"');
    expect(html).toContain('data-live-step="write"');
  });

  it("renders the /seal form outside the demo scope the two-column rule needs", () => {
    const real = renderToStaticMarkup(
      createElement(SealPage, {
        rpId: "revenant.devclef.se",
        appOrigin: "https://revenant.devclef.se",
        mode: "real",
      }),
    );
    // The /seal panel is the single form and carries the occasion control, but
    // no ancestor has data-seal-mode="demo", so the two-column rule cannot match.
    expect(real).toContain('data-card="live-write"');
    expect(real).toMatch(/<fieldset class="[^"]*occasions[^"]*"/);
    expect(real).not.toContain('data-seal-mode="demo"');
    expect(real).not.toMatch(/class="[^"]*liveWrite[^"]*"/);
  });

  it("puts the demo Write step's occasion control inside the data-seal-mode=demo root", () => {
    // /demo/live renders SealPage with no mode (demo by default). The root div
    // opens before its children, so the occasion control follows that marker.
    const demo = renderToStaticMarkup(
      createElement(SealPage, {
        rpId: "revenant.devclef.se",
        appOrigin: "https://revenant.devclef.se",
      }),
    );
    const root = demo.indexOf('data-seal-mode="demo"');
    expect(root).toBeGreaterThanOrEqual(0);
    const occasions = demo.search(/<fieldset class="[^"]*occasions[^"]*"/);
    expect(occasions).toBeGreaterThan(root);
    // The Write step is the desk (spec 14, W1): its root carries data-write-desk.
    expect(demo).toContain('data-write-desk=""');
  });

  it("defaults to demo mode when no mode is given", () => {
    const html = renderToStaticMarkup(
      createElement(SealPage, {
        rpId: "revenant.devclef.se",
        appOrigin: "https://revenant.devclef.se",
      }),
    );
    expect(html).toContain('data-seal-mode="demo"');
  });

  it("holds no validation message on first load in demo mode (spec 09, A4.4)", () => {
    const html = renderToStaticMarkup(
      createElement(SealPage, {
        rpId: "revenant.devclef.se",
        appOrigin: "https://revenant.devclef.se",
        mode: "demo",
      }),
    );
    expect(html).not.toContain(esc(LIVE_COPY.letterEmpty));
    expect(html).not.toContain(esc(LIVE_COPY.nothingToTestify));
    expect(html).not.toContain(esc(LIVE_COPY.warningUnticked));
  });

  it("holds no validation message on first load in real mode, including the date (spec 09, A4.4)", () => {
    const html = renderToStaticMarkup(
      createElement(SealPage, {
        rpId: "revenant.devclef.se",
        appOrigin: "https://revenant.devclef.se",
        mode: "real",
      }),
    );
    expect(html).not.toContain(esc(LIVE_COPY.letterEmpty));
    expect(html).not.toContain(esc(LIVE_COPY.nothingToTestify));
    expect(html).not.toContain(esc(LIVE_COPY.warningUnticked));
    expect(html).not.toContain(esc(REAL_COPY.dateMissing));
  });
});

/** React escapes quotes and ampersands in static markup. */
function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

describe("the Sealing_Flow step order (same in both modes)", () => {
  // The flow is one reducer shared by both modes; mode changes only the API.
  // The happy path goes Write, creating (passkey 1), created, confirming
  // (passkey 2), preparing, sealing, sealed. The figures and PRF_Check come
  // before the passkey on the Write step and are not reducer states.
  it("walks Write, passkey, confirm, prepare, seal, sealed in order", () => {
    const events: SealEvent[] = [
      { type: "CREATE_PRESS" },
      { type: "CREATED" },
      { type: "CONFIRM_PRESS" },
      { type: "CONFIRMED" },
      { type: "PREPARED" },
      {
        type: "SEALED",
        letterId: "wom_test",
        sealedAt: "2026-11-06T10:00:00.000Z",
        opensAt: "2026-12-06T00:00:00.000Z",
        offsetMs: 0,
        factors: "passkey",
        envelopeHash: "a".repeat(64),
      } as SealEvent,
    ];
    const tags: string[] = [INITIAL_SEAL_STATE.tag];
    let state: SealState = INITIAL_SEAL_STATE;
    for (const event of events) {
      state = sealReducer(state, event);
      tags.push(state.tag);
    }
    expect(tags).toEqual([
      "write",
      "creating",
      "created",
      "confirming",
      "preparing",
      "sealing",
      "sealed",
    ]);
  });
});

describe("SealPage in demo mode (/demo/live)", () => {
  it("holds no page heading on the Write step; the desk's own h1 holds the heading", () => {
    const html = renderToStaticMarkup(
      createElement(SealPage, {
        rpId: "revenant.devclef.se",
        appOrigin: "https://revenant.devclef.se",
        mode: "demo",
      }),
    );
    expect(LIVE_COPY.liveHeading).toBe("Seal your own letter");
    // The eyebrow carries the step's name as plain text, not as a heading (W2.2).
    expect(html).toMatch(/<p class="[^"]*eyebrow[^"]*">Seal your own letter<\/p>/);
    expect(html).toMatch(
      /<h1[^>]*data-step-heading=""[^>]*tabindex="-1"[^>]*>Write to the you who opens this\.<\/h1>/,
    );
    expect(html.split("<h1").length - 1).toBe(1);
  });

  it("does not show the demo heading in real mode", () => {
    const html = renderToStaticMarkup(
      createElement(SealPage, {
        rpId: "revenant.devclef.se",
        appOrigin: "https://revenant.devclef.se",
        mode: "real",
      }),
    );
    expect(html).not.toContain("Seal your own letter");
  });
});

describe("SealPage has exactly one h1 per demo step", () => {
  const base = {
    rpId: "revenant.devclef.se",
    appOrigin: "https://revenant.devclef.se",
    mode: "demo" as const,
  };

  afterEach(() => {
    pageStub.step = null;
  });

  it("holds the step name in a focusable h1 on Write and Seal", () => {
    for (const step of ["write", "seal"] as const) {
      pageStub.step = step;
      const html = renderToStaticMarkup(createElement(SealPage, base));
      // Write's h1 is the desk heading (spec 14, W2.3); Seal's h1 is the Seal
      // step's own heading (spec 14, S3.2).
      const name =
        step === "write" ? DESK_COPY.heading : "Press the seal\\.";
      expect(html, step).toMatch(
        new RegExp(
          `<h1[^>]*data-step-heading=""[^>]*tabindex="-1"[^>]*>${name}</h1>`,
        ),
      );
      expect(html.split("<h1").length - 1, step).toBe(1);
      if (step === "seal") {
        expect(html, step).not.toContain("Seal your own letter");
      }
    }
  });

  it("holds the page heading, not the step name, on Wait", () => {
    pageStub.step = "wait";
    const html = renderToStaticMarkup(createElement(SealPage, base));
    expect(html).toMatch(/<h1[^>]*>Seal your own letter<\/h1>/);
    expect(html).not.toContain("data-step-heading");
    expect(html.split("<h1").length - 1).toBe(1);
  });
});

describe("SealPage passes each figure's value and source into the picker", () => {
  afterEach(() => {
    pageStub.figures = null;
    pageStub.step = null;
  });

  it("shows the published value and source of every official series in the receipts on the Write step", () => {
    const response = figuresResponseFrom(DEMO_FIGURES);
    pageStub.figures = { status: "ready", figures: response };
    pageStub.step = "write";

    const html = renderToStaticMarkup(
      createElement(SealPage, {
        rpId: "revenant.devclef.se",
        appOrigin: "https://revenant.devclef.se",
        mode: "demo",
      }),
    );

    expect(html).toContain("data-receipt-panel");
    let checked = 0;
    for (const entry of response.series) {
      const figure = entry.figure;
      if (figure === null || figure.kind !== "official") continue;
      checked += 1;
      const shown = displayFigureValue(figure.value, figure.unit, figure.region);
      // The desk shows the value and short unit in the row, and the full
      // figure in Details (spec 14, W11).
      expect(html).toContain(esc(shown.text));
      expect(html).toContain(esc(`As published: ${figure.value} ${figure.unit}`));
      // The source name sits in the details list, one tap away (spec 11, W7).
      expect(html).toContain(`<dd>${esc(figure.source)}</dd>`);
      expect(html).toContain(esc(figure.source_url));
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("leaves a series with no figure out of the picker", () => {
    const response = figuresResponseFrom(DEMO_FIGURES);
    const first = response.series[0]!;
    const emptied = {
      ...response,
      series: [{ ...first, figure: null }, ...response.series.slice(1)],
    };
    pageStub.figures = { status: "ready", figures: emptied as typeof response };
    pageStub.step = "write";

    const html = renderToStaticMarkup(
      createElement(SealPage, {
        rpId: "revenant.devclef.se",
        appOrigin: "https://revenant.devclef.se",
        mode: "demo",
      }),
    );

    expect(html).not.toContain(`id="figure-${first.metric.id}"`);
  });
});

describe("SealPage rehearsal line (spec 11, L4.1, L4.3)", () => {
  const base = { rpId: "revenant.devclef.se", appOrigin: "https://revenant.devclef.se" };

  it("shows the rehearsal line once on the Write step, under the Fold_Button (spec 14, W13.4)", () => {
    const html = renderToStaticMarkup(createElement(SealPage, { ...base, rehearsal: true }));
    expect(html.split('data-live-rehearsal=""').length - 1).toBe(1);
    expect(html.indexOf(LIVE_COPY.rehearsalLine)).toBeGreaterThan(
      html.indexOf("data-fold-button"),
    );
    expect(html).toContain('data-live-step="write"');
  });

  it("carries no retired starter phrase or time word on the Write step", () => {
    const html = renderToStaticMarkup(createElement(SealPage, { ...base, rehearsal: true }));
    // Placeholder text is display text in the author's voice, not a question
    // or a line of the letter (spec 14, Decisions), so it is left out of this
    // scan. The rest of the Write step still has to pass.
    const lower = html.replace(/placeholder="[^"]*"/g, "").toLowerCase();
    for (const phrase of [
      "right now, the thing on my mind is",
      "what was on your mind most days?",
      "what were you looking forward to?",
    ]) {
      expect(lower, phrase).not.toContain(phrase);
    }
    for (const word of ["right now", "currently"]) {
      expect(lower, word).not.toContain(word);
    }
    // The intro and the sign-off are the desk's own copy (spec 14, W2.4, W4.4),
    // so "today" is allowed there. No question text may use it (tone.md).
    const questionTexts = [
      ...html.matchAll(
        /<textarea[^>]*class="[^"]*(?:textarea|qInput)[^"]*"[^>]*>([^<]*)<\/textarea>/g,
      ),
    ].map((m) => (m[1] ?? "").toLowerCase());
    expect(questionTexts.length).toBeGreaterThan(0);
    for (const text of questionTexts) {
      expect(text).not.toMatch(/\btoday\b/);
    }
  });

  it("puts no Demo label above the letter field, from the Write desk's start", () => {
    const html = renderToStaticMarkup(createElement(SealPage, { ...base, rehearsal: true }));
    const paperAt = html.indexOf('data-write-desk=""');
    const fieldAt = html.indexOf('id="live-letter"');
    expect(paperAt).toBeGreaterThan(-1);
    expect(fieldAt).toBeGreaterThan(paperAt);
    const above = html.slice(paperAt, fieldAt);
    expect(above).not.toContain(`>${DEMO_COPY.demoLabel}</span>`);
    expect(above).toContain(DESK_COPY.startFrom);
  });

  it("omits the sealed-in-the-browser sentence from the Write step", () => {
    const html = renderToStaticMarkup(createElement(SealPage, { ...base, rehearsal: true }));
    expect(html).not.toContain(LIVE_COPY.intro);
  });

  it("shows no rehearsal line without the prop, the default", () => {
    const html = renderToStaticMarkup(createElement(SealPage, base));
    expect(html).not.toContain("data-live-rehearsal");
    expect(html).not.toContain(LIVE_COPY.rehearsalLine);
  });

  it("shows no rehearsal line on the real /seal page", () => {
    const html = renderToStaticMarkup(createElement(SealPage, { ...base, mode: "real" }));
    expect(html).toContain('data-live-step="write"');
    expect(html).not.toContain(LIVE_COPY.rehearsalLine);
  });
});
