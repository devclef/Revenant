import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PREPARE_PATH,
  REAL_PREPARE_PATH,
  REAL_SEAL_PATH,
  realLetterSealApi,
} from "./api";
import { LIVE_COPY, REAL_COPY } from "./copy";
import { DESK_COPY } from "./desk/copy";
import type { SealState } from "./seal-machine";
import type { SealDeps } from "./seal-runner";
import { SealStep } from "./seal-step/SealStep";
import {
  initialStepperState,
  reduceStepper,
  stepName,
  type StepperStep,
} from "./stepper/live-steps";

// Real_Mode tests for SealPage (spec 19, task 6.2 and 6.3). The file renders
// with renderToStaticMarkup, so the flow's state and the stepper's step are
// set per render through the stubs below.

const stub = vi.hoisted(() => ({
  flowState: { tag: "write" } as import("./seal-machine").SealState,
  step: null as null | import("./stepper/live-steps").StepperStep,
  calls: [] as Array<{ deps: unknown; draft: unknown }>,
  keyText: "test-backup-key" as string | null,
  crypto: { browserAuthenticatorPort: {} },
}));

vi.mock("./useSealFlow", () => ({
  useSealFlow: (deps: unknown, draft: unknown) => {
    stub.calls.push({ deps, draft });
    return {
      state: stub.flowState,
      onCreatePress: () => {},
      onConfirmPress: () => {},
      onFallbackStart: () => {},
      onFallbackSealPress: () => {},
      onFallbackDecline: () => {},
      onRetry: () => {},
      getBackupKeyText: () => stub.keyText,
    };
  },
}));

vi.mock("./useCryptoModule", () => ({
  useCryptoModule: () => stub.crypto,
}));

vi.mock("./prf-hint", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./prf-hint")>()),
  usePrfHint: () => "missing",
}));

vi.mock("@/components/reveal/figures-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/reveal/figures-api")>()),
  useFigures: () => ({ status: "loading" }),
}));

// Keeps the real Live_Stepper, and sets its step to the one under test. The
// wrapper (data-live-stepper, the track and the announcement) stays the real one.
vi.mock("./stepper/LiveStepper", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./stepper/LiveStepper")>();
  return {
    ...actual,
    LiveStepper: (props: import("./stepper/LiveStepper").LiveStepperProps) => {
      if (stub.step === null) return actual.LiveStepper(props);
      return actual.LiveStepper({
        ...props,
        state: {
          ...props.state,
          step: stub.step,
          sealed: stub.step === "sealed",
        },
      });
    },
  };
});

import { SealPage } from "./SealPage";

const BASE = {
  rpId: "revenant.devclef.se",
  appOrigin: "https://revenant.devclef.se",
  mode: "real" as const,
};

const SEALED: SealState = {
  tag: "sealed",
  letterId: "letter-1",
  sealedAt: "2026-11-24T10:00:00.000Z",
  opensAt: "2029-11-24T00:00:00.000Z",
  offsetMs: 0,
  factors: "passkey",
  envelopeHash: "a".repeat(64),
};

const SEAL_FORM_TAGS = [
  "write",
  "creating",
  "created",
  "confirming",
  "preparing",
  "sealing",
] as const;
const FAILURE_TAGS = [
  "cannot_lock",
  "cancelled",
  "failed",
  "fallback_key",
] as const;

/** The text Requirement 4.11 forbids on every Real_Mode step and failure screen. */
const TEST_NOTICE =
  "This is a test site. A letter sealed here can only be opened here, or with its backup key.";
const FORBIDDEN_VISIBLE = [
  /demo/i,
  /rehearsal/i,
  /(?<!\d)30(?: seconds|-second)/i,
];
const FORBIDDEN_MARKUP = [
  'href="/demo"',
  "data-demo-label",
  "data-live-rehearsal",
  LIVE_COPY.backupChoiceSkipHelp,
  TEST_NOTICE,
];

interface Pair {
  name: string;
  step: StepperStep;
  state: SealState;
  /** The one h1 the step must hold, where the design fixes its text. */
  h1?: string;
}

/** Every step and Seal_State pair of the Real_Mode table (spec 19, design). */
const PAIRS: Pair[] = [
  {
    name: "write / write",
    step: "write",
    state: { tag: "write" },
    h1: DESK_COPY.heading,
  },
  ...SEAL_FORM_TAGS.map((tag) => ({
    name: `seal / ${tag}`,
    step: "seal" as const,
    state: { tag } as SealState,
    h1: tag === "write" ? LIVE_COPY.sealHeading : undefined,
  })),
  {
    name: "seal / cannot_lock",
    step: "seal",
    state: { tag: "cannot_lock", passkeyCreated: false },
  },
  { name: "seal / cancelled", step: "seal", state: { tag: "cancelled" } },
  {
    name: "seal / failed",
    step: "seal",
    state: { tag: "failed", kind: "network", passkeyCreated: false },
    h1: stepName("seal", "real"),
  },
  {
    name: "seal / fallback_key",
    step: "seal",
    state: { tag: "fallback_key", passkeyCreated: false },
    h1: LIVE_COPY.fallbackTitle,
  },
  {
    name: "sealed / sealed",
    step: "sealed",
    state: SEALED,
    h1: REAL_COPY.stillSealed,
  },
];

function renderReal(step: StepperStep, state: SealState): string {
  stub.step = step;
  stub.flowState = state;
  try {
    return renderToStaticMarkup(createElement(SealPage, BASE));
  } finally {
    stub.step = null;
    stub.flowState = { tag: "write" };
  }
}

/** The visible text of the markup: scripts, styles and tags removed. */
function visibleText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, " ")
    .replace(/<[^>]+>/g, " ");
}

function countOf(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

function h1Texts(html: string): string[] {
  return [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map(
    (match) => match[1] ?? "",
  );
}

function backButtonTag(html: string): string | undefined {
  return html.match(/<button[^>]*data-back-to-letter=""[^>]*>/)?.[0];
}

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  stub.calls = [];
  stub.keyText = "test-backup-key";
});

for (const pair of PAIRS) {
  describe(`Real_Mode, ${pair.name}`, () => {
    it("renders the Live_Stepper and no single-card form", () => {
      const html = renderReal(pair.step, pair.state);
      expect(html).toContain("data-live-stepper");
      expect(html).not.toContain('data-card="live-write"');
    });

    it("holds exactly one h1", () => {
      const html = renderReal(pair.step, pair.state);
      const headings = h1Texts(html);
      expect(headings).toHaveLength(1);
      if (pair.h1 !== undefined) expect(headings[0]).toContain(pair.h1);
    });

    it("carries no demo link, demo label, rehearsal line, skip help or Test_Notice markup", () => {
      const html = renderReal(pair.step, pair.state);
      for (const marker of FORBIDDEN_MARKUP) {
        expect(html, marker).not.toContain(marker);
      }
    });

    it("shows no visible text that Requirement 4.11 forbids", () => {
      const text = visibleText(renderReal(pair.step, pair.state));
      for (const pattern of FORBIDDEN_VISIBLE) {
        expect(text, String(pattern)).not.toMatch(pattern);
      }
    });
  });
}

describe("Real_Mode Seal step", () => {
  for (const tag of SEAL_FORM_TAGS) {
    it(`shows the intro once, before the date picker, with the Backup_Choice and the press (${tag})`, () => {
      const html = renderReal("seal", { tag } as SealState);
      expect(countOf(html, REAL_COPY.intro)).toBe(1);
      const picker = html.indexOf('id="real-opens-on"');
      expect(picker).toBeGreaterThan(-1);
      expect(html.indexOf(REAL_COPY.intro)).toBeLessThan(picker);
      expect(html).toContain("data-backup-choice");
      expect(html).toContain("data-press-column");
    });
  }

  it("holds Back enabled only while the tag is write", () => {
    const enabled = backButtonTag(renderReal("seal", { tag: "write" }));
    expect(enabled).toBeDefined();
    expect(enabled).not.toContain("disabled");
    for (const tag of SEAL_FORM_TAGS.filter((value) => value !== "write")) {
      const disabled = backButtonTag(renderReal("seal", { tag } as SealState));
      expect(disabled, tag).toBeDefined();
      expect(disabled, tag).toContain("disabled");
    }
  });
});

describe("Real_Mode Write step", () => {
  it("has no opening date input", () => {
    const html = renderReal("write", { tag: "write" });
    expect(html).not.toContain('id="real-opens-on"');
    expect(html).not.toContain(REAL_COPY.intro);
  });
});

describe("Real_Mode press with no opening date", () => {
  function renderSealStep(needsDate: boolean): string {
    return renderToStaticMarkup(
      createElement(SealStep, {
        tag: "write",
        backupChoice: "card",
        onBackupChoice: () => {},
        pressBlocked: needsDate,
        ready: true,
        mode: "write",
        questionCount: 0,
        prfMissing: false,
        onCreatePress: () => {},
        onConfirmPress: () => {},
        onAttempt: () => {},
        real: true,
        needsDate,
      }),
    );
  }

  /** The markup from the press column on: the press and its status line only. */
  function pressColumn(html: string): string {
    return html.slice(html.indexOf("data-press-column"));
  }

  it("blocks the press and says so on the status line", () => {
    const html = renderSealStep(true);
    expect(html).toContain(REAL_COPY.pressNeedsDate);
    expect(pressColumn(html)).toMatch(/aria-disabled="true"|disabled=""/);
  });

  it("does not block the press once a date is chosen", () => {
    const html = renderSealStep(false);
    expect(html).not.toContain(REAL_COPY.pressNeedsDate);
    expect(pressColumn(html)).not.toMatch(/aria-disabled="true"|disabled=""/);
  });
});

describe("Real_Mode Back from the Seal step", () => {
  it("returns to Write with the draft unchanged", () => {
    const start = initialStepperState("seal", "real");
    const back = reduceStepper(start, { type: "BACK" });
    expect(back.step).toBe("write");
    expect(back.draft).toEqual(start.draft);
  });
});

describe("Real_Mode requests and failure screens", () => {
  it("hands every render the Real_Routes api", () => {
    for (const pair of PAIRS) renderReal(pair.step, pair.state);
    expect(stub.calls.length).toBeGreaterThan(0);
    for (const call of stub.calls) {
      expect((call.deps as SealDeps).api).toBe(realLetterSealApi);
    }
  });

  it("sends prepare and seal to the Real_Routes and nothing to a demo route", async () => {
    renderReal("write", { tag: "write" });
    const deps = stub.calls[0]?.deps as SealDeps;
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await deps.api.prepare();
    await deps.api.seal({ letterId: "L", envelope: {}, envelopeHash: "h" });

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls).toEqual([REAL_PREPARE_PATH, REAL_SEAL_PATH]);
    expect(urls.some((url) => url.includes("/demo"))).toBe(false);
    expect(urls).not.toContain(PREPARE_PATH);
  });

  for (const tag of FAILURE_TAGS) {
    it(`replaces the step content on ${tag} and keeps Press the seal current`, () => {
      const pair = PAIRS.find((candidate) => candidate.state.tag === tag);
      if (pair === undefined) throw new Error(`no pair for ${tag}`);
      const html = renderReal(pair.step, pair.state);
      expect(html).not.toContain("data-seal-intro");
      expect(html).not.toContain("data-write-desk");
      expect(html).toContain(stepName("seal", "real"));
      expect(countOf(html, 'data-state="current"')).toBe(1);
    });
  }
});

describe("Real_Mode failure screens carry no demo or test-notice text", () => {
  for (const tag of FAILURE_TAGS) {
    it(`keeps every forbidden marker and phrase out of ${tag}`, () => {
      const pair = PAIRS.find((candidate) => candidate.state.tag === tag);
      if (pair === undefined) throw new Error(`no pair for ${tag}`);
      const html = renderReal(pair.step, pair.state);
      for (const marker of FORBIDDEN_MARKUP) {
        expect(html, marker).not.toContain(marker);
      }
      const text = visibleText(html);
      for (const pattern of FORBIDDEN_VISIBLE) {
        expect(text, String(pattern)).not.toMatch(pattern);
      }
    });

    it(`hands the ${tag} screen the Real_Routes api`, () => {
      const pair = PAIRS.find((candidate) => candidate.state.tag === tag);
      if (pair === undefined) throw new Error(`no pair for ${tag}`);
      stub.calls = [];
      renderReal(pair.step, pair.state);
      expect(stub.calls.length).toBeGreaterThan(0);
      for (const call of stub.calls) {
        expect((call.deps as SealDeps).api).toBe(realLetterSealApi);
      }
    });
  }
});
