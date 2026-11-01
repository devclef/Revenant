// Feature: 03-persona-demo, Property 20
//
// Property: a figure that ROSE and one that FELL render structurally identical
// ChangeLine markup. The only differences allowed are the numeric magnitude,
// the direction word (rose / fell) and the sign. Element tags and CSS classes
// are identical, there is no .rose / .fell variant, and there is no colour
// difference: up and down get the exact same visual treatment (neutrality.md).
//
// Validates R11.8, R16.4.
//
// Rendered with `renderToStaticMarkup` and `createElement` -- no DOM library
// and no JSX in the render path -- matching the existing reveal test style.
// fast-check drives it with numRuns 100 over a wide space of comparable figure
// pairs.
//
// The rise and the fall are exact mirrors: the same two periods, the same
// unit / region / source / series, and a now-value chosen so the fall is the
// rise reflected about the then-value. Because the two renders share both
// periods and all provenance, the ONLY text that legitimately differs between
// them is the direction word, the signed difference and the signed percent.
// The test normalises exactly those three display fragments out of each render
// (replacing them with a fixed token) and asserts the remaining markup -- every
// tag, every class, every static string -- is byte-for-byte equal.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";

import { ChangeLine } from "./ChangeLine";
import { FigureEntry, type FigureEntryProps } from "./FigureEntry";
import { FigureLine } from "./FigureLine";
import { FiguresThenNow } from "./FiguresThenNow";
import type { Opened } from "./opening-machine";
import {
  computeChange,
  formatChange,
  formatValue,
  type ChangeResult,
} from "@/lib/figures";
import { DEMO_FIGURES } from "@/lib/figures/demo";
import { thenAndNow } from "@/lib/figures/then-now";
import type { FigureV1, MetricDefinitionV1, PayloadV1 } from "@/lib/seal-format";
import type { RecallRecordV1 } from "@/lib/recall";
import { CEREMONY_COPY } from "@/components/ceremony/copy";
import { POSITION_PROPERTIES } from "@/components/ceremony/constants";
import { numberLineGeometry } from "@/components/ceremony/figures/number-line";
import { Counter } from "@/components/ceremony/figures/Counter";
import {
  ThenNowSequence,
  type ThenNowEntry,
  type ThenNowSequenceProps,
} from "@/components/ceremony/figures/ThenNowSequence";
import { LocalViewProvider } from "@/components/ceremony/local-view";
import { SkipProvider } from "@/components/ceremony/skip";
import { MotionProvider, type MotionMode } from "@/components/ceremony/motion";

// --- the motion mode for the calm clause -----------------------------------
//
// The real `MotionProvider` resolves `full` on the server and in the first
// render (R17.3), so a static render can never show `calm` through it. The
// mock below reads `motionState.mode`, which defaults to `full`, so every test
// that does not set it sees the same markup as the real provider. Only the
// calm clause changes it. `importOriginal` keeps every other export.

const motionState = vi.hoisted(() => ({ mode: "full" as MotionMode }));

vi.mock("@/components/ceremony/motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ceremony/motion")>();
  return {
    ...actual,
    useMotion: () => ({ mode: motionState.mode, setCalm: () => undefined }),
  };
});

// A fixed base figure. Only `value` and `period` vary across a run; the unit,
// region, source and series stay constant so every generated pair is
// comparable and the rise/fall mirror shares all provenance.
const BASE: Readonly<FigureV1> = {
  kind: "official",
  metric_id: "fuel",
  value: "0.000",
  unit: "USD per gallon",
  region: "U.S. city average",
  period: "2024-09",
  source: "U.S. EIA",
  series_id: "EMM_EPMR_PTE_NUS_DPG",
  retrieved_at: "2024-10-30T14:02:11Z",
  source_url: "https://www.eia.gov/series",
};

// A then-period strictly before the now-period, so computeChange's
// no_newer_figure check passes for both the rise and its mirror.
const THEN_PERIOD = "2024-09";
const NOW_PERIOD = "2026-09";

function figure(value: string, period: string): Readonly<FigureV1> {
  return { ...BASE, value, period };
}

function comparable(
  result: ChangeResult,
): Extract<ChangeResult, { comparable: true }> {
  if (!result.comparable) {
    throw new Error(`test setup: figures must be comparable (${result.reason})`);
  }
  return result;
}

function renderChange(
  result: Extract<ChangeResult, { comparable: true }>,
  then: Readonly<FigureV1>,
  now: Readonly<FigureV1>,
): string {
  return renderToStaticMarkup(
    createElement(ChangeLine, { result, region: then.region, then, now }),
  );
}

// Replace every occurrence of a dynamic display fragment with a fixed token, so
// what remains is the direction-independent skeleton: tags, classes and the
// static copy (the period range connector and the formula line). Longest
// fragments are replaced first so a shorter one never eats part of a longer.
// The formula line prints its inputs (issue #119), so the sealed now value,
// which differs between a rise and its mirror, is normalised too. The formula's
// operators and layout are still compared byte for byte.
function normalise(
  html: string,
  display: ReturnType<typeof formatChange>,
  inputValues: readonly string[],
): string {
  const fragments = [
    display.difference,
    display.percent ?? "",
    display.direction,
    ...inputValues,
  ].filter((f) => f.length > 0);
  // Longest first: the signed difference/percent can contain the magnitude, and
  // we want them removed whole rather than partially.
  fragments.sort((a, b) => b.length - a.length);

  let out = html;
  for (const fragment of fragments) {
    out = out.split(fragment).join("§");
  }
  return out;
}

describe("Property 20: a rise and a fall render the same markup (R11.8, R16.4)", () => {
  it("renders structurally identical markup except for magnitude, direction word and sign", () => {
    fc.assert(
      fc.property(
        // The then value (non-zero so a percent is defined for both directions)
        // and the size of the move. Two or three fraction digits, bounded
        // magnitudes, built as decimal STRINGS so no binary float ever appears.
        fc.record({
          thenWhole: fc.integer({ min: 1, max: 9999 }),
          thenFrac: fc.integer({ min: 0, max: 999 }),
          deltaWhole: fc.integer({ min: 0, max: 4999 }),
          deltaFrac: fc.integer({ min: 1, max: 999 }),
        }),
        ({ thenWhole, thenFrac, deltaWhole, deltaFrac }) => {
          // Decimal strings at three fraction digits throughout.
          const thenValue = `${thenWhole}.${String(thenFrac).padStart(3, "0")}`;

          // now = then + delta for the rise; the fall is the exact mirror:
          // now = then - delta. Both keep three fraction digits via integer
          // arithmetic on the scaled values, so the two moves are equal in
          // magnitude and opposite in direction.
          const scale = 1000n;
          const thenScaled =
            BigInt(thenWhole) * scale + BigInt(thenFrac);
          const deltaScaled =
            BigInt(deltaWhole) * scale + BigInt(deltaFrac);
          const riseScaled = thenScaled + deltaScaled;
          const fallScaled = thenScaled - deltaScaled;

          // Keep the fall's now-value non-negative so both figures stay
          // well-formed everyday prices; skip the rare case where the move
          // would cross zero.
          fc.pre(fallScaled >= 0n);

          const toDecimal = (scaled: bigint): string => {
            const whole = scaled / scale;
            const frac = scaled % scale;
            return `${whole}.${String(frac).padStart(3, "0")}`;
          };
          const riseNowValue = toDecimal(riseScaled);
          const fallNowValue = toDecimal(fallScaled);

          // Rise: then -> higher now. Fall: same then -> lower now. Same two
          // periods in both so the rendered period text is identical.
          const thenFig = figure(thenValue, THEN_PERIOD);
          const riseNow = figure(riseNowValue, NOW_PERIOD);
          const fallNow = figure(fallNowValue, NOW_PERIOD);

          const riseResult = comparable(computeChange(thenFig, riseNow));
          const fallResult = comparable(computeChange(thenFig, fallNow));

          const riseDisplay = formatChange(riseResult, thenFig.region);
          const fallDisplay = formatChange(fallResult, thenFig.region);

          // Sanity: the two directions really are a rise and a fall.
          expect(riseDisplay.direction).toBe("rose");
          expect(fallDisplay.direction).toBe("fell");

          const riseHtml = renderChange(riseResult, thenFig, riseNow);
          const fallHtml = renderChange(fallResult, thenFig, fallNow);

          // No direction-named CSS class in either render: a `class="..."`
          // attribute never contains "rose" or "fell", so styling cannot be
          // keyed on direction (neutrality.md). (The direction WORD appears as
          // body text, which these patterns deliberately do not match, since
          // they look only inside a class attribute value.)
          for (const html of [riseHtml, fallHtml]) {
            for (const classAttr of html.match(/class="[^"]*"/g) ?? []) {
              expect(classAttr).not.toContain("rose");
              expect(classAttr).not.toContain("fell");
            }
          }

          // With the magnitude, direction word and sign normalised out, the
          // remaining markup -- every tag and every class -- is byte-identical.
          const riseSkeleton = normalise(riseHtml, riseDisplay, [
            riseNowValue,
          ]);
          const fallSkeleton = normalise(fallHtml, fallDisplay, [
            fallNowValue,
          ]);
          expect(riseSkeleton).toBe(fallSkeleton);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Number_Line, whole-entry and stage 3 properties (design.md Properties 11, 12,
// 15, 17, 18 and the Property 20 extension, Requirements 9.x, 10.x, 12.x).
// ---------------------------------------------------------------------------

const CONSTANT_STYLE_PROPERTIES = [
  "animation-duration",
  "animation-timing-function",
  // The Counter's strip step count: COUNTER_ROLL_STEPS for every digit, so it
  // is the same on a rise and on a fall (Stamp renders it through Counter).
  "--counter-steps",
] as const;

// The only style properties an entry may carry (design.md Property 13, step 1).
const ALLOWED_STYLE_PROPERTIES: ReadonlySet<string> = new Set<string>([
  ...POSITION_PROPERTIES,
  ...CONSTANT_STYLE_PROPERTIES,
]);

/** A decimal string with three fraction digits, from an integer count of thousandths. */
function thousandths(scaled: number): string {
  if (!Number.isSafeInteger(scaled) || scaled < 0) {
    throw new RangeError(`test setup: ${scaled} is not a non-negative safe integer`);
  }
  return `${Math.floor(scaled / 1000)}.${String(scaled % 1000).padStart(3, "0")}`;
}

function markAnswerText(value: string, unit: string): string {
  return CEREMONY_COPY.markAnswer
    .replace("{value}", value)
    .replace("{unit}", unit);
}

/** Every Position_Property in document order, with its numeric value. */
function positionsIn(html: string): Array<{ name: string; value: number }> {
  return [...html.matchAll(/--pos-(then|now|mark):([^;"]+)/g)].map((m) => ({
    name: m[1] ?? "",
    value: Number(m[2]),
  }));
}

/** The names of every property in every style attribute, in document order. */
function styleNames(html: string): string[] {
  const names: string[] = [];
  for (const attr of html.match(/style="[^"]*"/g) ?? []) {
    const body = attr.slice('style="'.length, -1);
    for (const declaration of body.split(";")) {
      const colon = declaration.indexOf(":");
      if (colon > 0) names.push(declaration.slice(0, colon).trim());
    }
  }
  return names;
}

/** No class token names a direction: rose, fell, up or down (neutrality.md). */
function expectNoDirectionClass(html: string): void {
  for (const attr of html.match(/class="[^"]*"/g) ?? []) {
    for (const token of attr.slice('class="'.length, -1).split(/\s+/)) {
      const words = token.split(/[^a-zA-Z]+/).map((w) => w.toLowerCase());
      for (const forbidden of ["rose", "fell", "up", "down"]) {
        expect(words).not.toContain(forbidden);
      }
    }
  }
}

/**
 * The direction-independent skeleton: every Position_Property value becomes a
 * token, and in text nodes every number becomes `#` and the words rose and fell
 * become `§`. Tags, classes and static copy are left as they are.
 */
function skeletonOf(html: string): string {
  const withoutPositions = html.replace(
    /--pos-(then|now|mark):[^;"]+/g,
    "--pos-$1:§",
  );
  return withoutPositions.replace(/>([^<]*)</g, (_match, text: string) => {
    const normalised = text
      .replace(/[+−]?[0-9][0-9.,\u00a0\u202f]*/g, "#")
      .replace(/rose|fell/g, "§");
    return `>${normalised}<`;
  });
}

function renderEntry(
  then: Readonly<FigureV1>,
  now: Readonly<FigureV1>,
  mark?: string,
): string {
  const change = comparable(computeChange(then, now));
  const props: FigureEntryProps =
    mark === undefined
      ? { then, now, change }
      : { then, now, change, markValue: mark };
  return renderToStaticMarkup(createElement(FigureEntry, props));
}

describe("Property 11: the line's range comes from then and now only (R12.2)", () => {
  it("gives every Mark the same range, padding and then and now positions", () => {
    fc.assert(
      fc.property(
        fc.record({
          thenScaled: fc.integer({ min: 0, max: 9999999 }),
          nowScaled: fc.integer({ min: 0, max: 9999999 }),
          mark1: fc.integer({ min: 0, max: 20000000 }),
          mark2: fc.integer({ min: 0, max: 20000000 }),
        }),
        ({ thenScaled, nowScaled, mark1, mark2 }) => {
          const t = thousandths(thenScaled);
          const n = thousandths(nowScaled);
          const first = numberLineGeometry(t, n, thousandths(mark1));
          const second = numberLineGeometry(t, n, thousandths(mark2));

          expect(first.rangeLow).toBe(second.rangeLow);
          expect(first.rangeHigh).toBe(second.rangeHigh);
          expect(first.pad).toBe(second.pad);
          expect(first.posThen).toBe(second.posThen);
          expect(first.posNow).toBe(second.posNow);

          // Equal padding on both sides of the span.
          const lo = Math.min(Number(t), Number(n));
          const hi = Math.max(Number(t), Number(n));
          expect(
            Math.abs(lo - first.rangeLow - (first.rangeHigh - hi)),
          ).toBeLessThan(1e-9);

          // When then equals now the span is 10 % of the value, or 2 at zero.
          if (thenScaled === nowScaled) {
            const expectedSpan = thenScaled === 0 ? 2 : 0.1 * Number(t);
            expect(
              Math.abs(first.rangeHigh - first.rangeLow - expectedSpan),
            ).toBeLessThan(1e-9);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("Property 12: a Mark outside the range sits at an edge that looks the same on both sides (R12.3)", () => {
  it("puts both out-of-range Marks on an edge, with identical markup otherwise", () => {
    fc.assert(
      fc.property(
        fc.record({
          thenScaled: fc.integer({ min: 1000, max: 9999999 }),
          deltaScaled: fc.integer({ min: 1, max: 4999000 }),
          offset: fc.integer({ min: 1, max: 1000 }),
        }),
        ({ thenScaled, deltaScaled, offset }) => {
          const then = figure(thousandths(thenScaled), THEN_PERIOD);
          const now = figure(thousandths(thenScaled + deltaScaled), NOW_PERIOD);
          const geometry = numberLineGeometry(then.value, now.value);

          const low = (geometry.rangeLow - offset).toFixed(6);
          const high = (geometry.rangeHigh + offset).toFixed(6);
          const lowHtml = renderEntry(then, now, low);
          const highHtml = renderEntry(then, now, high);

          const lowMark = positionsIn(lowHtml).find((p) => p.name === "mark");
          const highMark = positionsIn(highHtml).find((p) => p.name === "mark");
          expect(lowMark?.value).toBe(0);
          expect(highMark?.value).toBe(1);

          // Only the Position_Property value and the Mark's text differ.
          const skeleton = (html: string, mark: string): string =>
            skeletonOf(html.split(markAnswerText(mark, then.unit)).join("MARK"));
          expect(skeleton(lowHtml, low)).toBe(skeleton(highHtml, high));
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("Property 20 (whole entry): a rise and its mirror fall render the same entry (R10.2-R10.4)", () => {
  it("renders the whole comparable entry with only allowed styles, mirrored positions and identical skeletons", () => {
    fc.assert(
      fc.property(
        fc.record({
          thenScaled: fc.integer({ min: 1000, max: 9999999 }),
          deltaScaled: fc.integer({ min: 1, max: 4999000 }),
          hasMark: fc.boolean(),
          markPermille: fc.integer({ min: 0, max: 1000 }),
        }),
        ({ thenScaled, deltaScaled, hasMark, markPermille }) => {
          // Fall only: now = then - delta must stay non-negative.
          fc.pre(thenScaled - deltaScaled >= 0);

          const then = figure(thousandths(thenScaled), THEN_PERIOD);
          const riseNow = figure(thousandths(thenScaled + deltaScaled), NOW_PERIOD);
          const fallNow = figure(thousandths(thenScaled - deltaScaled), NOW_PERIOD);

          // The Mark m lies in [0, 2t]; the fall reflects it to 2t - m.
          const markScaled = Math.floor((2 * thenScaled * markPermille) / 1000);
          const riseMark = hasMark ? thousandths(markScaled) : undefined;
          const fallMark = hasMark
            ? thousandths(2 * thenScaled - markScaled)
            : undefined;

          const riseHtml = renderEntry(then, riseNow, riseMark);
          const fallHtml = renderEntry(then, fallNow, fallMark);

          // Only the listed style properties appear, and no class names a direction.
          for (const html of [riseHtml, fallHtml]) {
            for (const name of styleNames(html)) {
              expect(ALLOWED_STYLE_PROPERTIES.has(name)).toBe(true);
            }
            expectNoDirectionClass(html);
          }

          // Every position p on the rise and 1 - p on the fall, in document order.
          const risePositions = positionsIn(riseHtml);
          const fallPositions = positionsIn(fallHtml);
          expect(fallPositions.map((p) => p.name)).toEqual(
            risePositions.map((p) => p.name),
          );
          expect(risePositions.length).toBe(hasMark ? 3 : 2);
          risePositions.forEach((p, i) => {
            const mirror = fallPositions[i];
            expect(mirror).toBeDefined();
            expect(
              Math.abs(p.value + (mirror?.value ?? Number.NaN) - 1),
            ).toBeLessThan(1e-9);
          });

          // With the positions and the Mark text normalised, the skeletons match.
          const withMarkText = (html: string, mark: string | undefined): string =>
            mark === undefined
              ? html
              : html.split(markAnswerText(mark, then.unit)).join("MARK");
          // Property 13 step 4: each Counter face collapses to one token first.
          // Its cell count follows the digits of the value, so a rise that
          // gains a digit would otherwise differ from its fall in structure.
          expect(
            skeletonOf(collapseCounterFaces(withMarkText(riseHtml, riseMark))),
          ).toBe(
            skeletonOf(collapseCounterFaces(withMarkText(fallHtml, fallMark))),
          );
          if (fallMark !== undefined) {
            expect(fallHtml).toContain(markAnswerText(fallMark, then.unit));
          }
        },
      ),
      { numRuns: 50 },
    );
  }, 30000);
});

// --- Stage 3 fixtures (Properties 15, 17, 18) ---------------------------------
// The now figures come from DEMO_FIGURES, the same frozen catalogue the reveal
// reads. Only the then values are generated by the properties.

const SEALED_AT = "2026-10-27T00:00:00.000Z";
const GAS_ID = "fixture-us-gasoline-regular";
const DIESEL_ID = "fixture-us-diesel";
const MISSING_ID = "fixture-us-missing";

function latestNow(metricId: string): Readonly<FigureV1> {
  const { now } = thenAndNow(metricId, SEALED_AT.slice(0, 10), DEMO_FIGURES);
  if (!now.found) throw new Error(`test setup: no now figure for ${metricId}`);
  return now.figure;
}

const GAS_NOW = latestNow(GAS_ID);
const DIESEL_NOW = latestNow(DIESEL_ID);

const GAS_METRIC: MetricDefinitionV1 = {
  id: GAS_ID,
  display_name: "Regular gasoline (fixture)",
  unit: GAS_NOW.unit,
  region: GAS_NOW.region,
  source: GAS_NOW.source,
  series_id: GAS_NOW.series_id,
};

const DIESEL_METRIC: MetricDefinitionV1 = {
  id: DIESEL_ID,
  display_name: "No. 2 diesel (fixture)",
  unit: DIESEL_NOW.unit,
  region: DIESEL_NOW.region,
  source: DIESEL_NOW.source,
  series_id: DIESEL_NOW.series_id,
};

const MISSING_METRIC: MetricDefinitionV1 = {
  id: MISSING_ID,
  display_name: "A discontinued fixture series",
  unit: "USD per gallon",
  region: "U.S.",
  source: "FIXTURE discontinued (fake data)",
  series_id: "FIXTURE-GONE",
};

const Q_GAS = {
  id: "q-gas",
  answer_type: "number" as const,
  text: "What do you think a gallon of regular gasoline cost then?",
  metric_id: GAS_ID,
};

const Q_DIESEL = {
  id: "q-diesel",
  answer_type: "number" as const,
  text: "What do you think a litre of diesel cost then?",
  metric_id: DIESEL_ID,
};

// Comparable with the gasoline now figure: same series, earlier period.
function gasFigure(value: string): Readonly<FigureV1> {
  return { ...GAS_NOW, value, period: "2023-11-06" };
}

// Not comparable: the unit differs from the now figure.
function dieselBadUnit(): Readonly<FigureV1> {
  return {
    ...DIESEL_NOW,
    value: "10.00",
    unit: "USD per litre",
    period: "2023-11-06",
  };
}

// Not comparable: the period is not a readable date.
function gasBadPeriod(): Readonly<FigureV1> {
  return { ...GAS_NOW, value: "1.50", period: "that autumn" };
}

// No now figure: the series is not in the catalogue.
function missingFigure(): Readonly<FigureV1> {
  return {
    kind: "official",
    metric_id: MISSING_ID,
    value: "2.00",
    unit: "USD per gallon",
    region: "U.S.",
    period: "2023-11-06",
    source: MISSING_METRIC.source,
    series_id: MISSING_METRIC.series_id,
    retrieved_at: "2000-01-01T00:00:00Z",
    source_url: "https://example.org/gone",
  };
}

function payloadFor(
  metrics: MetricDefinitionV1[],
  figures: Array<Readonly<FigureV1>>,
): PayloadV1 {
  return {
    format_version: 1,
    letter_text: "A short sealed letter.",
    written_as_of: "2023-11-06",
    metrics,
    figures: figures.map((f) => ({ ...f })),
    recall_questions: [Q_GAS, Q_DIESEL],
  };
}

function recordOf(
  answers: ReadonlyArray<readonly [string, string | undefined]>,
): RecallRecordV1 {
  return {
    version: 1,
    answers: answers.map(([questionId, value]) =>
      value === undefined
        ? { question_id: questionId, kind: "no_answer" as const }
        : { question_id: questionId, kind: "number" as const, value },
    ),
  };
}

function renderThenNow(payload: PayloadV1, record?: RecallRecordV1): string {
  const opened: Opened = {
    letterId: "letter-prop",
    header: { sealedAt: SEALED_AT, opensAt: "2026-11-05T00:00:00.000Z" },
    openingKey: {} as unknown as CryptoKey,
    payload,
  };
  const props = record === undefined ? { opened } : { opened, record };
  return renderToStaticMarkup(createElement(FiguresThenNow, props));
}

function figureLineMarkup(figure: Readonly<FigureV1>, role: "then" | "now"): string {
  return renderToStaticMarkup(
    createElement(FigureLine, {
      figure,
      role,
      displayRescale: DEMO_FIGURES.series.get(figure.metric_id)?.display_rescale,
    }),
  );
}

describe("Property 15: the static render is the final state (R9.1, R9.7, R9.8, R12.6)", () => {
  beforeEach(() => {
    // Stage 3 reads no network: any fetch fails the test.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new Error("FiguresThenNow tried to fetch");
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows every label, stamp face, source and change line, with or without a record", () => {
    fc.assert(
      fc.property(
        fc.record({
          thenScaled: fc.integer({ min: 1000, max: 9999999 }),
          withRecord: fc.boolean(),
          markK: fc.integer({ min: 0, max: 200000 }),
        }),
        ({ thenScaled, withRecord, markK }) => {
          const comparableThen = gasFigure(thousandths(thenScaled));
          const figures = [
            comparableThen,
            dieselBadUnit(),
            missingFigure(),
            gasBadPeriod(),
          ];
          const payload = payloadFor(
            [GAS_METRIC, DIESEL_METRIC, MISSING_METRIC],
            figures,
          );
          const record = recordOf([
            ["q-gas", (markK / 100).toFixed(2)],
            ["q-diesel", undefined],
          ]);

          const html = renderThenNow(payload, withRecord ? record : undefined);
          const plain = html.replace(/<!-- -->/g, "");

          // Every shown figure's FigureLine, unchanged, with its own period.
          expect(html).toContain(figureLineMarkup(comparableThen, "then"));
          expect(html).toContain(figureLineMarkup(GAS_NOW, "now"));
          expect(html).toContain(figureLineMarkup(dieselBadUnit(), "then"));
          expect(html).toContain(figureLineMarkup(DIESEL_NOW, "now"));
          expect(html).toContain(figureLineMarkup(missingFigure(), "then"));

          // Stamp face and source name for the comparable entry.
          expect(plain).toContain(
            `${formatValue(comparableThen.value, comparableThen.region)} ${comparableThen.unit}`,
          );
          expect(plain).toContain(GAS_NOW.source);

          // The change line for the comparable pair names its direction.
          const change = computeChange(comparableThen, GAS_NOW);
          if (!change.comparable) throw new Error("test setup: pair must be comparable");
          expect(plain).toContain(
            formatChange(change, comparableThen.region).direction,
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("Property 17: figures stay in payload order (R9.3, R12.1)", () => {
  it("keeps the payload's order whatever the values and Marks are", () => {
    fc.assert(
      fc.property(
        fc.record({
          thenScaled: fc.integer({ min: 1000, max: 9999999 }),
          withRecord: fc.boolean(),
          markK: fc.integer({ min: 0, max: 200000 }),
          reversed: fc.boolean(),
        }),
        ({ thenScaled, withRecord, markK, reversed }) => {
          const metrics = [GAS_METRIC, DIESEL_METRIC, MISSING_METRIC];
          const figures = [
            gasFigure(thousandths(thenScaled)),
            dieselBadUnit(),
            missingFigure(),
          ];
          const orderedMetrics = reversed ? [...metrics].reverse() : metrics;
          const orderedFigures = reversed ? [...figures].reverse() : figures;
          const payload = payloadFor(orderedMetrics, orderedFigures);
          const record = recordOf([
            ["q-gas", (markK / 100).toFixed(2)],
            ["q-diesel", (markK / 200).toFixed(2)],
          ]);

          const html = renderThenNow(payload, withRecord ? record : undefined);
          const expectedNames = orderedMetrics.map((m) => m.display_name);
          const positions = expectedNames.map((name) => html.indexOf(name));

          expect(positions.every((p) => p >= 0)).toBe(true);
          expect([...positions].sort((a, b) => a - b)).toEqual(positions);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("Property 18: not-comparable and unavailable entries draw no line (R9.6)", () => {
  it("draws no Number_Line and no Mark, and keeps the FigureLine markup of each figure", () => {
    fc.assert(
      fc.property(
        fc.record({
          markK: fc.integer({ min: 0, max: 200000 }),
          withRecord: fc.boolean(),
        }),
        ({ markK, withRecord }) => {
          const figures = [dieselBadUnit(), missingFigure(), gasBadPeriod()];
          const payload = payloadFor(
            [DIESEL_METRIC, MISSING_METRIC, GAS_METRIC],
            figures,
          );
          const record = recordOf([
            ["q-gas", (markK / 100).toFixed(2)],
            ["q-diesel", (markK / 50).toFixed(2)],
          ]);

          const html = renderThenNow(payload, withRecord ? record : undefined);

          // No line, no pins, no Mark.
          expect(html).not.toContain("--pos-");
          expect(html).not.toContain(CEREMONY_COPY.markAnswer.split("{")[0] ?? "");

          // The #49 markup for each figure shown: then, and now where it exists.
          expect(html).toContain(figureLineMarkup(dieselBadUnit(), "then"));
          expect(html).toContain(figureLineMarkup(DIESEL_NOW, "now"));
          expect(html).toContain(figureLineMarkup(missingFigure(), "then"));
          expect(html).toContain(figureLineMarkup(gasBadPeriod(), "then"));
          expect(html).toContain(figureLineMarkup(GAS_NOW, "now"));
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- Counter clause of Property 13, and the calm clause of Property 20 --------

/**
 * Every `[data-counter]` cell in a markup string, each as its own substring.
 * A cell ends where its own `<span>` closes, found by counting nested spans, so
 * the nested digit strips never cut a cell short.
 */
function counterCells(html: string): string[] {
  const marker = 'data-counter="digit"';
  const cells: string[] = [];
  let from = 0;
  for (;;) {
    const at = html.indexOf(marker, from);
    if (at === -1) break;
    const start = html.lastIndexOf("<span", at);
    const spans = /<span\b|<\/span>/g;
    spans.lastIndex = start;
    let depth = 0;
    let end = html.length;
    for (let m = spans.exec(html); m !== null; m = spans.exec(html)) {
      if (m[0] === "</span>") {
        depth -= 1;
        if (depth === 0) {
          end = m.index + m[0].length;
          break;
        }
      } else {
        depth += 1;
      }
    }
    cells.push(html.slice(start, end));
    from = end;
  }
  return cells;
}

/**
 * Each Counter face (`counterFace`, its digit cells and strips) replaced by one
 * token. The face's markup depends on how many digits the value has, so the
 * whole-entry skeleton compares each face as one token (Property 13 step 4).
 */
function collapseCounterFaces(html: string): string {
  const open = /<span class="[^"]*counterFace[^"]*" aria-hidden="true">/;
  let out = html;
  for (let match = open.exec(out); match !== null; match = open.exec(out)) {
    const start = match.index;
    const spans = /<span\b|<\/span>/g;
    spans.lastIndex = start;
    let depth = 0;
    let end = out.length;
    for (let m = spans.exec(out); m !== null; m = spans.exec(out)) {
      if (m[0] === "</span>") {
        depth -= 1;
        if (depth === 0) {
          end = m.index + m[0].length;
          break;
        }
      } else {
        depth += 1;
      }
    }
    out = `${out.slice(0, start)}§COUNTER§${out.slice(end)}`;
  }
  return out;
}

/** The digits in a value, in order. */
function digitCount(value: string): number {
  return value.replace(/\D/g, "").length;
}

/** Renders a Counter in full motion (the server and first render). */
function counterMarkup(value: string): string {
  return renderToStaticMarkup(
    createElement(MotionProvider, null, createElement(Counter, { value })),
  );
}

describe("Property 13 (counter clause): every counter cell matches once its digits are replaced (R10.6)", () => {
  it("gives each [data-counter] cell the same markup, for a rise and its mirror fall", () => {
    fc.assert(
      fc.property(
        fc.record({
          thenScaled: fc.integer({ min: 1000, max: 9999999 }),
          deltaScaled: fc.integer({ min: 1, max: 4999000 }),
        }),
        ({ thenScaled, deltaScaled }) => {
          fc.pre(thenScaled - deltaScaled >= 0);
          const values = [
            thousandths(thenScaled),
            thousandths(thenScaled + deltaScaled),
            thousandths(thenScaled - deltaScaled),
          ];

          const cells = values.flatMap((value) => counterCells(counterMarkup(value)));
          // One cell per digit, and at least one cell in every counter.
          expect(cells.length).toBe(values.reduce((n, v) => n + digitCount(v), 0));

          const reference = skeletonOf(cells[0] ?? "");
          for (const cell of cells) {
            expect(skeletonOf(cell)).toBe(reference);
          }

          // Collapse every counter to a token, as Property 13 step 4 does.
          for (const value of values) {
            const html = counterMarkup(value);
            let collapsed = html;
            for (const cell of counterCells(html)) {
              collapsed = collapsed.split(cell).join("§");
            }
            expect(collapsed).not.toContain('data-counter="digit"');
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

/** Renders the stage 3 sequence with a static child, in whatever mode is set. */
function renderSequence(count: number): string {
  const entries: ThenNowEntry[] = Array.from({ length: count }, (_, index) => ({
    key: `metric-${index}`,
  }));
  const sequenceProps: ThenNowSequenceProps = {
    entries,
    children: createElement("p", null, "figures"),
  };
  return renderToStaticMarkup(
    createElement(
      LocalViewProvider,
      null,
      createElement(
        SkipProvider,
        null,
        createElement(
          MotionProvider,
          null,
          createElement(ThenNowSequence, sequenceProps),
        ),
      ),
    ),
  );
}

describe("Property 20 (calm clause): Calm_Mode jumps straight to the final state (R11.2)", () => {
  beforeEach(() => {
    motionState.mode = "calm";
  });

  afterEach(() => {
    motionState.mode = "full";
  });

  it("renders the stage 3 sequence and its Counters at their final state, with no animation", () => {
    fc.assert(
      fc.property(
        fc.record({
          count: fc.integer({ min: 0, max: 20 }),
          digits: fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 1, maxLength: 8 }),
        }),
        ({ count, digits }) => {
          const value = digits.join("");

          // The sequence in calm is the settled `done` state and nothing animates.
          motionState.mode = "calm";
          const calmSequence = renderSequence(count);
          expect(calmSequence).toContain('data-step="done"');
          expect(calmSequence).not.toContain("animation-duration");
          expect(calmSequence).not.toContain("data-counter");

          // Full motion's server render is the same final state, so calm equals it.
          motionState.mode = "full";
          const finalSequence = renderSequence(count);
          expect(calmSequence).toBe(finalSequence);

          // A Counter in calm rests on each digit: no roll class, no animation,
          // and each strip's last digit is the value's digit (the final state).
          motionState.mode = "calm";
          const calmCounter = counterMarkup(value);
          expect(calmCounter).not.toContain("animation-duration");
          expect(calmCounter).not.toMatch(/class="[^"]*roll/);
          const cells = counterCells(calmCounter);
          expect(cells.length).toBe(value.length);
          cells.forEach((cell, index) => {
            const strip = [...cell.matchAll(/counterDigit[^"]*">(\d)<\/span>/g)].map((m) =>
              Number(m[1]),
            );
            expect(strip.length).toBe(10);
            expect(strip[strip.length - 1]).toBe(Number(value[index]));
          });
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("Property 20 (counter clause): a rise and its mirror fall roll every counter cell alike (R10.6, R11.2)", () => {
  it("gives every [data-counter] cell of the rise and of the fall the same markup once its digits are replaced", () => {
    fc.assert(
      fc.property(
        fc.record({
          thenScaled: fc.integer({ min: 1000, max: 9999999 }),
          deltaScaled: fc.integer({ min: 1, max: 4999000 }),
        }),
        ({ thenScaled, deltaScaled }) => {
          // The fall is the exact mirror of the rise, so both stay non-negative.
          fc.pre(thenScaled - deltaScaled >= 0);
          const riseValue = thousandths(thenScaled + deltaScaled);
          const fallValue = thousandths(thenScaled - deltaScaled);

          const riseCells = counterCells(counterMarkup(riseValue));
          const fallCells = counterCells(counterMarkup(fallValue));

          // One cell per digit on each side, so a rise and its fall are counted alike.
          expect(riseCells.length).toBe(digitCount(riseValue));
          expect(fallCells.length).toBe(digitCount(fallValue));

          // Digits replaced, every cell on both sides is the same markup.
          const digitless = (cell: string): string => cell.replace(/\d/g, "#");
          const reference = digitless(riseCells[0] ?? "");
          for (const cell of [...riseCells, ...fallCells]) {
            expect(digitless(cell)).toBe(reference);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
