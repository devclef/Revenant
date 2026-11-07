import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { realLetterSealApi, realSealApi, REAL_PREPARE_PATH, REAL_SEAL_PATH, PREPARE_PATH } from "./api";
import { LIVE_COPY, REAL_COPY } from "./copy";
import { figuresResponseFrom } from "@/components/reveal/figures-stub";
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
  step: null as null | "figures",
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
    expect(html).not.toContain(esc(LIVE_COPY.figuresNone));
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
    expect(html).not.toContain(esc(LIVE_COPY.figuresNone));
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
  it("renders the liveHeading above the Live_Stepper", () => {
    const html = renderToStaticMarkup(
      createElement(SealPage, {
        rpId: "revenant.devclef.se",
        appOrigin: "https://revenant.devclef.se",
        mode: "demo",
      }),
    );
    expect(LIVE_COPY.liveHeading).toBe("Seal your own letter");
    expect(html).toMatch(/<h1[^>]*>Seal your own letter<\/h1>/);
    expect(html.indexOf("Seal your own letter")).toBeLessThan(
      html.indexOf("data-live-stepper"),
    );
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

describe("SealPage passes each figure's value and source into the picker", () => {
  afterEach(() => {
    pageStub.figures = null;
    pageStub.step = null;
  });

  it("shows the published value and source of every official series on the figures step", () => {
    const response = figuresResponseFrom(DEMO_FIGURES);
    pageStub.figures = { status: "ready", figures: response };
    pageStub.step = "figures";

    const html = renderToStaticMarkup(
      createElement(SealPage, {
        rpId: "revenant.devclef.se",
        appOrigin: "https://revenant.devclef.se",
        mode: "demo",
      }),
    );

    expect(html).toContain('data-card="live-figures"');
    let checked = 0;
    for (const entry of response.series) {
      const figure = entry.figure;
      if (figure === null || figure.kind !== "official") continue;
      checked += 1;
      expect(html).toContain(esc(LIVE_COPY.figureValue.replace("{value}", figure.value)));
      expect(html).toContain(esc(LIVE_COPY.figureSource.replace("{source}", figure.source)));
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
    pageStub.step = "figures";

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
