import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEMO_COPY } from "../demo/copy";
import { DESK_COPY } from "./desk/copy";
import { LIVE_COPY, REAL_COPY } from "./copy";
import { PRESS_COPY } from "./press/copy";
import type { PickableSeries } from "./catalogue-list";
import { WriteForm, type WriteFormProps } from "./WriteForm";
import type { SealState } from "./seal-machine";

/**
 * Spec 14, X1 (wording fixes). The strings below are the X1.1 to X1.4 values
 * written out in full, so a wording change fails here and not in a snapshot.
 */
const X1_STRINGS = {
  busyBody:
    "The live demo is busy right now. Nothing was sealed. Try again later. Your letter is still here.",
  figuresHint: "Choose up to {max}.",
  figuresHintOne: "You can choose 1.",
  chooseFirst: "Choose a backup option first.",
  backupChoiceLegend: "If you lose this passkey",
  blank: "A blank page",
} as const;

/**
 * X1.5 fixture: the keys section `all` rendered at commit ba2cd6c, with the
 * value each had at that commit (`git show ba2cd6c:src/components/live/copy.ts`).
 * Section `all` is the `/seal` form, so the check renders it in real mode
 * (`realDate` set). `passkeySteps` is the same string now (X1.5: unchanged).
 *
 * Not in this fixture, because `all` did not render them at ba2cd6c:
 * - `receiptsAction`: its button sat under `section === "write"` only.
 * - `answerInLetter`: deleted from LIVE_COPY by spec 16 (Write desk), with no replacement.
 */
const BA2CD6C_ALL_KEYS = {
  receiptsSummary: "Receipts",
  authorQuestionAdd: "Add a question",
  occasionLegend: "What is it about?",
  passkeySteps:
    'Your device will ask for the passkey twice. Each time, you press a button first. The passkey will be named "Efterhand demo" in your passkey manager.',
} as const;

/** The X1.5 keys. Their values are the ba2cd6c copy, unchanged by X1. `answerInLetter` was deleted by spec 16. */
const X1_5_VALUES: Record<string, string> = {
  receiptsAction: "Add a receipt",
  receiptsSummary: "Receipts",
  authorQuestionAdd: "Add a question",
  occasionLegend: "What is it about?",
  passkeySteps: BA2CD6C_ALL_KEYS.passkeySteps,
};
const X1_5_KEYS = Object.keys(X1_5_VALUES);

const REAL_DATE = {
  value: null,
  min: "2027-02-18",
  timeZoneFallback: false,
  onChange: () => {},
};

const SERIES: PickableSeries[] = [
  {
    metricId: "us-gasoline-regular",
    displayName: "Regular gasoline",
    unit: "USD per gallon",
    region: "U.S.",
    latestPeriod: "2026-10-26",
    periodType: "weekly",
    source:
      "U.S. Energy Information Administration (EIA), Weekly Retail Gasoline and Diesel Prices",
    isFixture: false,
  },
];

function props(overrides: Partial<WriteFormProps> = {}): WriteFormProps {
  return {
    series: SERIES,
    state: { tag: "write" } satisfies SealState,
    cryptoLoaded: true,
    text: "Dear me",
    metricIds: ["us-gasoline-regular"],
    warningTicked: true,
    backupCardTicked: false,
    onTextChange: () => {},
    onToggleFigure: () => {},
    onWarningChange: () => {},
    onBackupCardChange: () => {},
    onCreatePress: () => {},
    onConfirmPress: () => {},
    ...overrides,
  };
}

const render = (overrides: Partial<WriteFormProps> = {}) =>
  renderToStaticMarkup(createElement(WriteForm, props(overrides)));

/** Escapes a string the way React escapes text nodes in static markup. */
function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** True when the markup holds `value` as a whole text node, not inside an attribute. */
function hasTextNode(html: string, value: string): boolean {
  return html.includes(`>${escapeText(value)}<`);
}

/** Every string value in a copy object, nested objects included. */
function collectStrings(value: unknown, found: string[] = []): string[] {
  if (typeof value === "string") {
    found.push(value);
  } else if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) collectStrings(child, found);
  }
  return found;
}

describe("X1.1 to X1.4: exact wording", () => {
  it("busyBody reads the X1.1 string", () => {
    expect(LIVE_COPY.busyBody).toBe(X1_STRINGS.busyBody);
  });

  it("figuresHint and figuresHintOne read the X1.2 strings", () => {
    expect(LIVE_COPY.figuresHint).toBe(X1_STRINGS.figuresHint);
    expect(LIVE_COPY.figuresHintOne).toBe(X1_STRINGS.figuresHintOne);
  });

  it("PRESS_COPY.chooseFirst and backupChoiceLegend read the X1.3 strings", () => {
    expect(PRESS_COPY.chooseFirst).toBe(X1_STRINGS.chooseFirst);
    expect(LIVE_COPY.backupChoiceLegend).toBe(X1_STRINGS.backupChoiceLegend);
  });

  it("occasionLabels.blank reads the X1.4 string", () => {
    expect(LIVE_COPY.occasionLabels.blank).toBe(X1_STRINGS.blank);
  });
});

describe("X1.5: WriteForm keys by section", () => {
  it("the five X1.5 keys still in LIVE_COPY are all present", () => {
    expect(X1_5_KEYS).toHaveLength(5);
    for (const key of X1_5_KEYS) {
      expect(LIVE_COPY).toHaveProperty(key);
    }
  });

  it("the fixture values match the current copy, except where X1 changed them", () => {
    for (const key of X1_5_KEYS) {
      expect(LIVE_COPY[key as keyof typeof LIVE_COPY]).toBe(X1_5_VALUES[key]);
    }
  });

  it("passkeySteps is unchanged from ba2cd6c", () => {
    expect(LIVE_COPY.passkeySteps).toBe(BA2CD6C_ALL_KEYS.passkeySteps);
  });

  for (const section of ["write", "seal"] as const) {
    for (const mode of ["demo", "real"] as const) {
      it(`section ${section} in ${mode} mode renders none of the six keys`, () => {
        const html = render({
          section,
          onNext: () => {},
          realDate: mode === "real" ? REAL_DATE : undefined,
        });
        for (const key of X1_5_KEYS) {
          expect(hasTextNode(html, X1_5_VALUES[key]), key).toBe(false);
        }
      });
    }
  }

  it("section all (the /seal form) still renders every key it rendered at ba2cd6c", () => {
    const html = render({ section: "all", realDate: REAL_DATE });
    for (const key of Object.keys(
      BA2CD6C_ALL_KEYS,
    ) as (keyof typeof BA2CD6C_ALL_KEYS)[]) {
      expect(hasTextNode(html, BA2CD6C_ALL_KEYS[key]), key).toBe(true);
    }
  });
});

describe("X1.6: no Demo 1 or Demo 2 in Our_Copy on /demo/live and /demo", () => {
  const copyModules: Record<string, unknown> = {
    LIVE_COPY,
    REAL_COPY,
    DESK_COPY,
    PRESS_COPY,
    DEMO_COPY,
  };

  for (const [name, module] of Object.entries(copyModules)) {
    it(`${name} has no "Demo 1" or "Demo 2"`, () => {
      for (const text of collectStrings(module)) {
        expect(text, text).not.toMatch(/Demo 1|Demo 2/);
      }
    });
  }
});
