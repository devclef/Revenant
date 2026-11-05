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
    value: 3.47,
    noAnswer: false,
    onEdit: () => undefined,
    ...overrides,
  };
  return renderToStaticMarkup(<RecallScale {...props} />);
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
          expect(readoutOf(render({ value: v }))).toBe(text);
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
  it("the props are only id, label, unit label, value, no-answer, onEdit, and the read-only flags", () => {
    expectTypeOf<keyof RecallScaleProps>().toEqualTypeOf<
      | "id"
      | "label"
      | "unitLabel"
      | "value"
      | "noAnswer"
      | "onEdit"
      | "spokenPrefix"
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

  it("the readout is the plain decimal, with thousands grouped only in labels", () => {
    expect(readoutOf(render({ value: 1712.4 }))).toBe("1710");
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
