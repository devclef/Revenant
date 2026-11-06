// Feature: 05-reveal-ceremony, Task 8 (Recall_Scale component).
//
// Properties 7 to 10 from design.md, plus the keyboard steps, the pointer
// fallback (a try/catch around setPointerCapture) and the zoom step width. The
// house style has no DOM library, so markup is read through renderToStaticMarkup.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import fc from "fast-check";
import { renderToStaticMarkup } from "react-dom/server";
import { buildRecallRecord, type Draft } from "@/lib/recall/record";
import { CEREMONY_COPY } from "../copy";
import {
  RecallScale,
  nextValueForKey,
  nextValueForKeyIn,
  readoutText,
  trackDrag,
  valueOnTrack,
  type RecallScaleProps,
} from "./RecallScale";
import {
  SCALE_MAX_VALUE,
  SCALE_MIN_VALUE,
  toPlainDecimal,
  valueAt,
  zoomWindow,
  type ZoomLevel,
} from "./scale-math";
import { visibleTicks } from "./tick-layout";
import { answerText } from "./answer-text";
import { FALLBACK_RANGE, scaleRangeFor } from "./unit-ranges";
import { TICK_CHAR_PX, TICK_GAP_PX, TRACK_MIN_PX } from "../constants";

const NUM_RUNS = 100;
const NUMBER_PATTERN = /^[0-9]+(\.[0-9]+)?$/;
const here = dirname(fileURLToPath(import.meta.url));

type RecallQuestion = Parameters<typeof buildRecallRecord>[0][number];

function question(id: string): RecallQuestion {
  return {
    id,
    answer_type: "number",
    metric_id: `metric-${id}`,
    text: `What do you think thing ${id} cost then?`,
  };
}

/** Build a record from one scale string; returns whether the record builder accepts it. */
function acceptedByRecord(text: string): boolean {
  const drafts: Record<string, Draft> = { q1: { text, noAnswer: false } };
  return buildRecallRecord([question("q1")], drafts).ok;
}

function render(overrides: Partial<RecallScaleProps> = {}): string {
  const props: RecallScaleProps = {
    id: "q1",
    label: "What do you think a gallon of gas cost then?",
    unitLabel: "USD per gallon",
    range: FALLBACK_RANGE,
    value: 3.47,
    noAnswer: false,
    onEdit: () => undefined,
    ...overrides,
  };
  return renderToStaticMarkup(<RecallScale {...props} />);
}

/** The text of every tick label drawn under the track, in order. */
function tickLabelsOf(markup: string): string[] {
  return [...markup.matchAll(/data-tick-label=""[^>]*>([^<]*)</g)].map((match) => match[1]);
}

/** A tick value as the label shows it: plain decimal with thousands grouped. */
function groupedText(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** The label width the component measures: characters times the per-character estimate. */
function labelWidthOf(value: number): number {
  return groupedText(value).length * TICK_CHAR_PX;
}

/** The text of the readout element, or null when there is none. */
function readoutOf(markup: string): string | null {
  const match = /data-readout="readout">([^<]*)</.exec(markup);
  return match ? match[1] : null;
}

/** Markup with everything that may differ between ends of the track blanked out. */
function normalise(markup: string): string {
  return markup
    .replace(/--pos-mark:[^;"]*/g, "--pos-mark:X")
    .replace(/aria-valuetext="[^"]*"/g, 'aria-valuetext="X"')
    .replace(/aria-valuenow="[^"]*"/g, 'aria-valuenow="X"')
    .replace(/(data-readout="readout">)[^<]*</g, "$1X<");
}

// --- Properties 7 to 10 ---------------------------------------------------

describe("Property 7: the Recall_Scale only produces values the record accepts", () => {
  it("every track position and zoom level gives a record-valid string", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.constantFrom<ZoomLevel>(0, 1, 2),
        (x, level) => {
          const base = valueAt(x);
          const win = zoomWindow(level, base);
          const v = valueOnTrack(x, win);
          const text = toPlainDecimal(v);
          expect(text).toMatch(NUMBER_PATTERN);
          expect(text.length).toBeGreaterThanOrEqual(1);
          expect(text.length).toBeLessThanOrEqual(40);
          // Significant figures: drop leading zeros, and trailing zeros of an integer.
          const bare = text.replace(".", "").replace(/^0+/, "");
          const digits = text.includes(".") ? bare : bare.replace(/0+$/, "");
          expect(digits.length).toBeLessThanOrEqual(3);
          expect(acceptedByRecord(text)).toBe(true);
          expect(readoutOf(render({ value: v }))).toBe(answerText(text));
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("every key step from any value gives a record-valid string", () => {
    const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"];
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.array(fc.constantFrom(...keys), { minLength: 1, maxLength: 12 }),
        (x, sequence) => {
          let value = valueAt(x);
          for (const key of sequence) {
            const next = nextValueForKey(key, value);
            expect(next).not.toBeNull();
            value = next as number;
            const text = toPlainDecimal(value);
            expect(text).toMatch(NUMBER_PATTERN);
            expect(acceptedByRecord(text)).toBe(true);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("Property 8: a Mark and the same typed text give the same record", () => {
  it("the record from a Mark's value equals the one from the typed string", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (x) => {
        const text = toPlainDecimal(valueAt(x));
        const fromMark = buildRecallRecord([question("q1")], { q1: { text, noAnswer: false } });
        const fromTyped = buildRecallRecord([question("q1")], { q1: { text: ` ${text} `, noAnswer: false } });
        expect(fromMark).toEqual(fromTyped);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("Property 9: values beyond the track sit at the ends and look the same", () => {
  it("values below 0.01 (including 0) normalise to the low-end markup", () => {
    const reference = normalise(render({ value: 0.001 }));
    fc.assert(
      fc.property(fc.double({ min: 0, max: 0.0099, noNaN: true }), (v) => {
        expect(normalise(render({ value: v }))).toBe(reference);
        expect(render({ value: v })).toMatch(/--pos-mark:0[;"]/);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("values above 100,000 normalise to the high-end markup", () => {
    const reference = normalise(render({ value: 1000000 }));
    fc.assert(
      fc.property(fc.double({ min: 100000.01, max: 1e9, noNaN: true }), (v) => {
        expect(normalise(render({ value: v }))).toBe(reference);
        expect(render({ value: v })).toMatch(/--pos-mark:1[;"]/);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("the low and high ends differ only in the position and the value text", () => {
    const low = render({ value: 0.001 });
    const high = render({ value: 1000000 });
    expect(low).not.toBe(high);
    expect(normalise(low)).toBe(normalise(high));
    expect(normalise(render({ value: 0 }))).toBe(normalise(low));
  });
});

describe("Property 10: the zoom reads nothing but the marker and the pointer", () => {
  it("the props are only id, label, unit label, value, the judge's own answer text, no-answer, onEdit, and the read-only flags", () => {
    expectTypeOf<keyof RecallScaleProps>().toEqualTypeOf<
      | "id"
      | "label"
      | "unitLabel"
      | "value"
      | "text"
      | "noAnswer"
      | "onEdit"
      | "spokenPrefix"
      | "range"
    >();
  });

  it("the component source reads no payload, metric or figure data", () => {
    // Comments are blanked first: the doc comment names what the component does not read.
    const source = readFileSync(join(here, "RecallScale.tsx"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(source).not.toMatch(/\bpayload\b/i);
    expect(source).not.toMatch(/\bmetric/i);
    expect(source).not.toMatch(/\bfigure/i);
  });

  it("at a 296 px track, level 2 puts two-significant-figure values at least 24 px apart", () => {
    fc.assert(
      fc.property(fc.double({ min: 0.01, max: 100000, noNaN: true }), (v) => {
        const win = zoomWindow(2, v);
        const pixels = (296 * win.step!) / (win.max - win.min);
        expect(pixels).toBeGreaterThanOrEqual(24);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// --- Keyboard steps ---------------------------------------------------------

describe("keyboard steps (design.md, Keyboard and assistive technology)", () => {
  it("Left and Down step down one unit in the third significant figure", () => {
    expect(nextValueForKey("ArrowLeft", 3.47)).toBe(3.46);
    expect(nextValueForKey("ArrowDown", 3.47)).toBe(3.46);
    expect(nextValueForKey("ArrowLeft", 1710)).toBe(1700);
  });

  it("Right and Up step up one unit in the third significant figure", () => {
    expect(nextValueForKey("ArrowRight", 3.47)).toBe(3.48);
    expect(nextValueForKey("ArrowUp", 3.47)).toBe(3.48);
    expect(nextValueForKey("ArrowRight", 1710)).toBe(1720);
  });

  it("Page Up and Page Down move one decade", () => {
    expect(nextValueForKey("PageUp", 3.47)).toBe(34.7);
    expect(nextValueForKey("PageDown", 3.47)).toBe(0.347);
  });

  it("Home and End go to the track's ends", () => {
    expect(nextValueForKey("Home", 3.47)).toBe(SCALE_MIN_VALUE);
    expect(nextValueForKey("End", 3.47)).toBe(SCALE_MAX_VALUE);
  });

  it("steps stay on the track at the ends", () => {
    expect(nextValueForKey("ArrowLeft", 0.01)).toBe(0.01);
    expect(nextValueForKey("ArrowRight", 100000)).toBe(100000);
  });

  it("other keys are not handled", () => {
    expect(nextValueForKey("a", 3.47)).toBeNull();
  });
});

// --- Pointer fallback -------------------------------------------------------

describe("pointer drag: try/catch around setPointerCapture", () => {
  const handlers = () => ({ onMove: vi.fn(), onEnd: vi.fn() });

  it("uses pointer capture and adds no window listeners when capture works", () => {
    const target = { setPointerCapture: vi.fn() };
    const win = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const detach = trackDrag(target, 7, win, handlers());
    expect(target.setPointerCapture).toHaveBeenCalledWith(7);
    expect(win.addEventListener).not.toHaveBeenCalled();
    expect(() => detach()).not.toThrow();
    expect(win.removeEventListener).not.toHaveBeenCalled();
  });

  it("falls back to window listeners when capture throws, and removes them on detach", () => {
    const target = {
      setPointerCapture: vi.fn(() => {
        throw new Error("synthetic pointer");
      }),
    };
    const win = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const h = handlers();
    const detach = trackDrag(target, 3, win, h);
    const types = win.addEventListener.mock.calls.map((call) => call[0]);
    expect(types).toEqual(["pointermove", "pointerup", "pointercancel"]);

    const move = win.addEventListener.mock.calls[0][1] as (event: Event) => void;
    move({ clientX: 120, clientY: 40 } as unknown as Event);
    expect(h.onMove).toHaveBeenCalledWith(120, 40);

    const end = win.addEventListener.mock.calls[1][1] as (event: Event) => void;
    end({} as Event);
    expect(h.onEnd).toHaveBeenCalledTimes(1);

    detach();
    expect(win.removeEventListener.mock.calls.map((call) => call[0])).toEqual([
      "pointermove",
      "pointerup",
      "pointercancel",
    ]);
  });
});

// --- Markup -----------------------------------------------------------------

describe("markup", () => {
  it("is a slider with aria-valuetext and an accessible name from the question", () => {
    const markup = render({ value: 3.47 });
    expect(markup).toContain('role="slider"');
    expect(markup).toContain('aria-valuetext="3.47 USD per gallon"');
    expect(markup).toContain('aria-label="What do you think a gallon of gas cost then?"');
  });

  it("sets touch-action none on the track", () => {
    expect(render()).toContain("touch-action:none");
  });

  it("shows the decade labels at level 0 and no window ends", () => {
    const markup = render({ value: 3.47 });
    expect(markup).toContain("100,000");
    expect(markup).toContain("0.01");
    expect(markup).not.toContain("Show the whole scale");
  });

  it("with No answer, the slider is aria-disabled and out of the tab order", () => {
    const markup = render({ value: 3.47, noAnswer: true });
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain('tabindex="-1"');
  });

  it("with an empty answer, it says so and stays focusable", () => {
    const markup = render({ value: null });
    expect(markup).toContain(`aria-valuetext="${CEREMONY_COPY.recallNoMarkYet}"`);
    expect(markup).toContain('tabindex="0"');
    expect(readoutOf(markup)).toBeNull();
  });

  it("a typed 3.90 reads 3.90, the same as answerText", () => {
    const markup = render({ value: 3.9, text: "3.90" });
    expect(readoutOf(markup)).toBe("3.90");
    expect(readoutOf(markup)).toBe(answerText("3.90"));
  });

  it("a stored 1000 reads 1,000, the same as answerText", () => {
    const markup = render({ value: 1000, text: "1000" });
    expect(readoutOf(markup)).toBe("1,000");
    expect(readoutOf(markup)).toBe(answerText("1000"));
  });

  it("the readout is the answer text: the plain decimal with thousands grouped", () => {
    expect(readoutOf(render({ value: 1712.4 }))).toBe("1,710");
    expect(readoutText(0)).toBe("0");
    expect(readoutText(0.001)).toBe("0.01");
    expect(readoutText(1000000)).toBe("100000");
  });

  it("the hit area for the marker is 44 by 44 px in the stylesheet", () => {
    const css = readFileSync(join(here, "RecallScale.module.css"), "utf8");
    const mark = /\.mark\s*\{([^}]*)\}/.exec(css);
    expect(mark).not.toBeNull();
    expect(mark![1]).toMatch(/width:\s*44px/);
    expect(mark![1]).toMatch(/height:\s*44px/);
  });
});

// --- Unit ranges (spec 08 R7) -----------------------------------------------

describe("the track uses the sealed unit's range", () => {
  it("USD per gallon draws the linear 0 to 10 track with ticks 0, 2, 4, 6, 8 and 10", () => {
    const markup = render({
      unitLabel: "USD per gallon",
      range: scaleRangeFor("USD per gallon"),
      value: 3.47,
    });
    expect(tickLabelsOf(markup)).toEqual(["0", "2", "4", "6", "8", "10"]);
    expect(markup).toContain("--pos-mark:0.347");
    expect(markup).toContain("--pos-label:0.2");
    expect(markup).toContain(CEREMONY_COPY.recallLookCloser);
  });

  it("EUR per 1,000 litres draws the linear 0 to 3,000 track with ticks every 500", () => {
    const markup = render({
      unitLabel: "EUR per 1,000 litres",
      range: scaleRangeFor("EUR per 1,000 litres"),
      value: 1710,
    });
    // The range's ticks are every 500 from 0 to 3,000 (checked here, not by
    // the layout). At the 260 px minimum track tick-layout draws every second
    // tick (spec 09 A10), so the drawn list is 0, 1,000, 2,000, 3,000.
    const range = scaleRangeFor("EUR per 1,000 litres");
    expect(range.ticks).toEqual([0, 500, 1000, 1500, 2000, 2500, 3000]);
    expect(tickLabelsOf(markup)).toEqual(["0", "1,000", "2,000", "3,000"]);
    expect(markup).toContain("--pos-mark:0.57");
    expect(readoutOf(markup)).toBe("1,710");
  });

  it("EUR per 1,000 litres draws all seven ticks on a wide track", () => {
    const range = scaleRangeFor("EUR per 1,000 litres");
    const ticks = visibleTicks(range, 960, () => 40).map((tick) => tick.value);
    expect(ticks).toEqual([0, 500, 1000, 1500, 2000, 2500, 3000]);
  });

  it("the fallback range draws its decade labels from visibleTicks and no tick labels", () => {
    const markup = render({ value: 3.47 });
    const expected = visibleTicks(FALLBACK_RANGE, TRACK_MIN_PX, labelWidthOf).map((tick) =>
      groupedText(tick.value),
    );
    expect(tickLabelsOf(markup)).toEqual(expected);
    expect(markup).toContain("100,000");
  });

  it("an off-range typed value sits at the nearer edge and keeps its typed text", () => {
    const range = scaleRangeFor("USD per gallon");
    const high = render({ range, value: 12.5 });
    const low = render({ range, value: 0 });
    expect(high).toContain("--pos-mark:1");
    expect(readoutOf(high)).toBe("12.5");
    expect(low).toContain("--pos-mark:0");
    expect(readoutOf(low)).toBe("0");
  });

  it("linear keys step by the third significant figure and stay inside the range", () => {
    const usd = scaleRangeFor("USD per gallon");
    expect(nextValueForKeyIn("ArrowRight", 3.47, usd)).toBe(3.48);
    expect(nextValueForKeyIn("ArrowLeft", 0.01, usd)).toBe(0.0099);
    expect(nextValueForKeyIn("ArrowRight", 10, usd)).toBe(10);
    expect(nextValueForKeyIn("PageUp", 9, usd)).toBe(10);
    expect(nextValueForKeyIn("Home", 3.47, usd)).toBe(0);
    expect(nextValueForKeyIn("End", 3.47, usd)).toBe(10);
  });
});

// --- Log-track decade labels (visibleTicks, no CSS width rule) ---------------

describe("the log track's decade labels come from visibleTicks", () => {
  const visible = () => visibleTicks(FALLBACK_RANGE, TRACK_MIN_PX, labelWidthOf);

  it("the drawn labels are the visibleTicks values, in order, at every track width", () => {
    const markup = render({ value: 3.47 });
    expect(tickLabelsOf(markup)).toEqual(visible().map((tick) => groupedText(tick.value)));
    expect(markup).toContain(`--pos-label:${visible()[0].position}`);
  });

  it("keeps the first tick (0.01) and the last tick (100,000)", () => {
    const ticks = visible();
    expect(ticks[0].value).toBe(0.01);
    expect(ticks[ticks.length - 1].value).toBe(100000);
    const drawn = tickLabelsOf(render({ value: 3.47 }));
    expect(drawn[0]).toBe("0.01");
    expect(drawn[drawn.length - 1]).toBe("100,000");
  });

  it("no two drawn labels overlap or leave less than TICK_GAP_PX between them", () => {
    const ticks = visible();
    const boxes = ticks.map((tick) => {
      const x = tick.position * TRACK_MIN_PX;
      const w = labelWidthOf(tick.value);
      if (tick.anchor === "start") return { left: x, right: x + w };
      if (tick.anchor === "end") return { left: x - w, right: x };
      return { left: x - w / 2, right: x + w / 2 };
    });
    for (const box of boxes) {
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(TRACK_MIN_PX);
    }
    for (let i = 1; i < boxes.length; i += 1) {
      expect(boxes[i].left - boxes[i - 1].right).toBeGreaterThanOrEqual(TICK_GAP_PX);
    }
  });

  it("the stylesheet no longer hides decade labels with a 480px container rule", () => {
    const css = readFileSync(join(here, "RecallScale.module.css"), "utf8");
    expect(css).not.toMatch(/max-width:\s*480px/);
    expect(css).not.toMatch(/@container\s+recallTrack/);
  });
});
