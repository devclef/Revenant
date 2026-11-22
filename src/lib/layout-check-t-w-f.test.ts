import { describe, expect, it } from "vitest";

import {
  f3Failures,
  f4Failures,
  lf1Failures,
  lf2Failures,
  rectsIntersect,
  t1Failures,
  tg2Failures,
  w8Failures,
  w8Row,
  wFailures,
} from "../../tools/qa/layout-check.mjs";

/**
 * Unit tests for the T1, TG2, W, W8, LF1, LF2, F3 and F4 layout rows (spec 13) in
 * tools/qa/layout-check.mjs. The rows themselves need a browser; these tests cover the
 * pure verdicts they use.
 */

type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

const rect = (
  left: number,
  top: number,
  width: number,
  height: number,
): Rect => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
  width,
  height,
});

const DESKTOP = { w: 1440, h: 900, remPx: 16 };
const PHONE = { w: 390, h: 844, remPx: 16 };

describe("rectsIntersect", () => {
  it("counts overlapping rects and not rects that only touch", () => {
    expect(rectsIntersect(rect(0, 0, 100, 100), rect(50, 50, 100, 100))).toBe(
      true,
    );
    expect(rectsIntersect(rect(0, 0, 100, 100), rect(100, 0, 100, 100))).toBe(
      false,
    );
    expect(rectsIntersect(rect(0, 0, 100, 100), rect(0, 100, 100, 100))).toBe(
      false,
    );
  });

  it("returns false when either rect is missing", () => {
    expect(rectsIntersect(null, rect(0, 0, 10, 10))).toBe(false);
  });
});

describe("t1Failures (T1.2, T1.3)", () => {
  const view = rect(100, 100, 400, 300);
  const countdown = rect(100, 420, 400, 30);

  it("passes when the view and countdown are in the viewport and the Keep_Section starts below the view", () => {
    const failures = t1Failures({
      view,
      countdown,
      keep: rect(0, 480, 1000, 400),
      ...DESKTOP,
    });
    expect(failures).toEqual([]);
  });

  it("names T1.2 when the envelope view is outside the First_Viewport", () => {
    const failures = t1Failures({
      view: rect(100, 800, 400, 300),
      countdown,
      keep: rect(0, 1200, 10, 10),
      ...DESKTOP,
    });
    expect(failures).toEqual([
      "T1.2 Sealed_Envelope_View is not inside the First_Viewport",
    ]);
  });

  it("names T1.2 when the countdown is missing or outside the viewport", () => {
    expect(
      t1Failures({
        view,
        countdown: null,
        keep: rect(0, 480, 10, 10),
        ...DESKTOP,
      }),
    ).toEqual(["T1.2 countdown is not inside the First_Viewport"]);
  });

  it("names T1.3 when the Keep_Section starts above the view bottom", () => {
    const failures = t1Failures({
      view,
      countdown,
      keep: rect(0, 350, 10, 10),
      ...DESKTOP,
    });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(
      /^T1\.3 Keep_Section top 350\.0px is above the view bottom 400\.0px/,
    );
  });

  it("reports a missing view with the requirement name", () => {
    expect(
      t1Failures({ view: null, countdown, keep: null, ...DESKTOP }),
    ).toEqual(["T1.2 no [data-sealed-envelope-view] to measure"]);
  });
});

describe("tg2Failures (T2.2)", () => {
  it("passes when the ghost sits above the Keep_Section", () => {
    expect(
      tg2Failures({
        ghost: rect(0, 0, 200, 300),
        keep: rect(0, 480, 1000, 400),
      }),
    ).toEqual([]);
  });

  it("names T2.2 when the ghost box intersects the Keep_Section", () => {
    expect(
      tg2Failures({
        ghost: rect(0, 400, 200, 300),
        keep: rect(0, 480, 1000, 400),
      }),
    ).toEqual(["T2.2 the risen ghost intersects the Keep_Section"]);
  });
});

describe("wFailures (W1.3, W4.4; W1.1, W1.2, W3.3, W7.2 retired)", () => {
  const goodField = rect(300, 300, 700, 200);
  const goodQuestion = { height: 60, lineHeight: 24, padY: 12 };

  it("passes a desktop Write step with the Letter_Field top at most 360 px down", () => {
    expect(
      wFailures({ ...DESKTOP, field: goodField, questions: [goodQuestion] }),
    ).toEqual([]);
  });

  it("names W1.3 when the Letter_Field top is more than 360 px from the top at 1440", () => {
    const failures = wFailures({
      ...DESKTOP,
      field: rect(300, 400, 700, 200),
      questions: [],
    });
    expect(failures).toEqual([
      "W1.3 Letter_Field top is 400px from the top, need at most 360px",
    ]);
  });

  it("passes W1.3 when the Letter_Field top is exactly 360 px from the top at 1440", () => {
    const failures = wFailures({
      ...DESKTOP,
      field: rect(300, 360, 700, 200),
      questions: [],
    });
    expect(failures).toEqual([]);
  });

  it("names W1.3 when the Letter_Field top is outside the viewport at 390", () => {
    const failures = wFailures({
      ...PHONE,
      field: rect(20, 900, 350, 200),
      questions: [],
    });
    expect(failures).toEqual([
      "W1.3 Letter_Field top is outside the First_Viewport",
    ]);
  });

  it("no longer judges the column, paper, Occasion or receipt rows (retired; W1, W4, W3, W11, W12 replace them)", () => {
    // Before the retirement these inputs failed W1.1, W1.2, W3.3 and W7.2. Now only W1.3 and
    // W4.4 are judged, so a Write step with any of those widths or heights passes here.
    expect(wFailures({ ...DESKTOP, field: goodField, questions: [] })).toEqual(
      [],
    );
    expect(wFailures({ ...PHONE, field: rect(20, 100, 350, 200), questions: [] })).toEqual(
      [],
    );
  });

  it("names W4.4 when a question row is taller than two lines at 1440", () => {
    const failures = wFailures({
      ...DESKTOP,
      field: goodField,
      questions: [{ height: 90, lineHeight: 24, padY: 12 }],
    });
    expect(failures).toEqual([
      "W4.4 question row 1 is 90px tall, need at most two lines (60px)",
    ]);
  });

  it("reports a missing Letter_Field with the requirement name", () => {
    expect(
      wFailures({
        ...DESKTOP,
        field: null,
        questions: [],
      }),
    ).toEqual(["W1.3 no Letter_Field (#live-letter) to measure"]);
  });
});

describe("w8Failures (W8.2)", () => {
  it("passes a heading starting 16 px below the Top_Bar", () => {
    expect(w8Failures({ heading: { top: 116 }, topBarBottom: 100 })).toEqual(
      [],
    );
  });

  it("names W8.2 for a heading 15.5 px below the Top_Bar", () => {
    expect(w8Failures({ heading: { top: 115.5 }, topBarBottom: 100 })).toEqual([
      "W8.2 step heading top is 15.5px below the Top_Bar, need at least 16px",
    ]);
  });

  it("names W8.2 when no heading is measured", () => {
    expect(w8Failures({ heading: null, topBarBottom: 100 })).toEqual([
      "W8.2 no step heading to measure",
    ]);
  });
});

describe("w8Row (W8, per step change)", () => {
  const ok = { missing: false, step: "seal", heading: { top: 120 }, topBarBottom: 100 };
  const low = { missing: false, step: "seal", heading: { top: 110 }, topBarBottom: 100 };

  it("names the press and the step in the detail of a passing row", () => {
    const row = w8Row({ label: "Next press 2", viewport: "1440x900", r: ok });
    expect(row.status).toBe("pass");
    expect(row.detail).toMatch(/^after Next press 2 step=seal /);
  });

  it("names W8.2 and the press in a failing row", () => {
    const row = w8Row({ label: "Next press 3", viewport: "1440x900", r: low });
    expect(row.status).toBe("fail");
    expect(row.detail).toContain("after Next press 3 step=seal");
    expect(row.detail).toContain("W8.2 step heading top is 10.0px below the Top_Bar, need at least 16px");
  });

  it("gives each step change its own detail text", () => {
    const a = w8Row({ label: "Next press 1", viewport: "390x844", r: { ...ok, step: "text" } });
    const b = w8Row({ label: "Next press 2", viewport: "390x844", r: { ...ok, step: "figures" } });
    expect(a.detail).not.toBe(b.detail);
    expect(a.detail).toContain("step=text");
    expect(b.detail).toContain("step=figures");
  });

  it("reports a missing heading or Top_Bar as missing with the press named", () => {
    expect(w8Row({ label: "Next press 1", viewport: "390x844", r: { missing: true } })).toMatchObject({
      status: "missing",
      detail: expect.stringContaining("after Next press 1"),
    });
    expect(
      w8Row({ label: "Next press 1", viewport: "390x844", r: { ...ok, topBarBottom: null } }),
    ).toMatchObject({ status: "missing", detail: expect.stringContaining("no [data-topbar]") });
  });
});

describe("lf1Failures (F1.4)", () => {
  it("passes a section with content reaching past 60 % of its width", () => {
    const failures = lf1Failures([
      { name: "Ritual", left: 100, width: 1000, leafRights: [300, 800] },
    ]);
    expect(failures).toEqual([]);
  });

  it("names F1.4 for a section whose content stops in the left 60 %", () => {
    const failures = lf1Failures([
      { name: "No seal", left: 100, width: 1000, leafRights: [300, 500] },
    ]);
    expect(failures).toEqual([
      "F1.4 No seal has no content in its right 40% (content box 100..1100px)",
    ]);
  });
});

describe("lf2Failures (F2.1 to F2.3)", () => {
  const card = (over: Partial<Record<string, number | boolean>> = {}) => ({
    left: 0,
    top: 0,
    right: 300,
    bottom: 200,
    padding: 24,
    textWidth: 250,
    fontSize: 16,
    lineHeight: 24,
    clipped: false,
    ...over,
  });
  const grid = [
    card({ left: 0, top: 0, right: 300, bottom: 200 }),
    card({ left: 324, top: 0, right: 624, bottom: 200 }),
    card({ left: 0, top: 224, right: 300, bottom: 424 }),
    card({ left: 324, top: 224, right: 624, bottom: 424 }),
  ];

  it("passes a 2 × 2 grid with 24 px padding, 24 px gaps and 16 px text at 1.5", () => {
    expect(lf2Failures({ items: grid, w: 1440 })).toEqual([]);
  });

  it("names F2.1 for padding below 24 px and text narrower than 200 px at 1440", () => {
    const failures = lf2Failures({
      items: [card({ padding: 16, textWidth: 150 })],
      w: 1440,
    });
    expect(failures).toEqual([
      "F2.1 card 1 padding is 16px, need at least 24px",
      "F2.1 card 1 text width is 150px, need at least 200px",
    ]);
  });

  it("names F2.1 for cards closer than 24 px", () => {
    const close = [
      card({ left: 0, right: 300 }),
      card({ left: 310, right: 610 }),
    ];
    expect(lf2Failures({ items: close, w: 1440 })).toEqual([
      "F2.1 cards 1 and 2 are 10px apart, need at least 24px",
    ]);
  });

  it("names F2.1 for body text below 16 px or line height below 1.5", () => {
    expect(
      lf2Failures({
        items: [card({ fontSize: 15, lineHeight: 22.5 })],
        w: 1440,
      }),
    ).toEqual([
      "F2.1 card 1 body text is 15.0px at line height 22.5px, need 16px at 1.5",
    ]);
  });

  it("passes a phone stack of cards with 20 px padding in one column", () => {
    const stack = [
      card({ padding: 20, left: 20, top: 0 }),
      card({ padding: 20, left: 20, top: 240 }),
    ];
    expect(lf2Failures({ items: stack, w: 390 })).toEqual([]);
  });

  it("names F2.2 for phone cards not in one column and for padding below 20 px", () => {
    const offset = [
      card({ padding: 20, left: 20 }),
      card({ padding: 16, left: 40 }),
    ];
    expect(lf2Failures({ items: offset, w: 390 })).toEqual([
      "F2.2 card 2 padding is 16px, need at least 20px",
      "F2.2 ritual cards are not stacked in one column",
    ]);
  });

  it("names F2.3 for a card that clips its text", () => {
    expect(lf2Failures({ items: [card({ clipped: true })], w: 1440 })).toEqual([
      "F2.3 card 1 clips its text",
    ]);
  });
});

describe("f3Failures (F3.1, F3.2; F3.4 retired)", () => {
  const notice = rect(900, 20, 300, 20);
  const question = rect(100, 300, 600, 60);
  const answer = rect(100, 400, 600, 80);
  const cont = rect(100, 520, 200, 40);

  it("passes when the notice clears the labels and the controls lie in the viewport", () => {
    const failures = f3Failures({
      ...DESKTOP,
      notice,
      labels: [rect(100, 20, 100, 20)],
      question,
      answer,
      cont,
    });
    expect(failures).toEqual([]);
  });

  it("names F3.1 when the notice overlaps a step label", () => {
    const failures = f3Failures({
      ...DESKTOP,
      notice,
      labels: [rect(850, 20, 200, 20)],
      question,
      answer,
      cont,
    });
    expect(failures).toEqual([
      "F3.1 the fictional notice overlaps a Step_Indicator label",
    ]);
  });

  it("names F3.2 when the answer control is below the viewport", () => {
    const failures = f3Failures({
      ...DESKTOP,
      notice,
      labels: [],
      question,
      answer: rect(100, 880, 600, 80),
      cont,
    });
    expect(failures).toEqual([
      "F3.2 answer control is not inside the First_Viewport",
    ]);
  });

  it("names F3.2 when the question or the control to go on is below the viewport", () => {
    const failures = f3Failures({
      ...DESKTOP,
      notice,
      labels: [],
      question: rect(100, 880, 600, 60),
      answer,
      cont: rect(100, 950, 200, 40),
    });
    expect(failures).toEqual([
      "F3.2 question is not inside the First_Viewport",
      "F3.2 control to go on is not inside the First_Viewport",
    ]);
  });

  it("reports a missing question heading and names F3.2", () => {
    const failures = f3Failures({
      ...DESKTOP,
      notice,
      labels: [],
      question: null,
      answer,
      cont,
    });
    expect(failures).toEqual(["F3.2 no question heading to measure"]);
  });

  it("no longer counts the notice (F3.4 retired; B1.4 checks the notice text once, in the Top_Bar)", () => {
    const failures = f3Failures({
      ...DESKTOP,
      notice,
      labels: [],
      question,
      answer,
      cont,
    });
    expect(failures).toEqual([]);
  });
});

describe("f4Failures (F4.1 to F4.3)", () => {
  const ghost = rect(900, 150, 300, 500);
  const verdict = rect(100, 300, 400, 30);
  const question = rect(100, 200, 400, 40);
  const answer = rect(100, 360, 400, 60);

  it("passes when the Ghost is in the viewport, clear of the text, and the verdict has 16 px under the Top_Bar", () => {
    const failures = f4Failures({
      ...DESKTOP,
      ghost,
      topBarBottom: 80,
      verdict,
      others: [
        ["question", question],
        ["answer control", answer],
        ["verdict line", verdict],
      ],
    });
    expect(failures).toEqual([]);
  });

  it("names F4.1 when no Ghost is drawn", () => {
    expect(
      f4Failures({
        ...DESKTOP,
        ghost: null,
        topBarBottom: 80,
        verdict,
        others: [],
      }),
    ).toEqual(["F4.1 no Ghost drawn on the live Remember step"]);
  });

  it("names F4.2 when the verdict line starts less than 16 px below the Top_Bar", () => {
    const failures = f4Failures({
      ...DESKTOP,
      ghost,
      topBarBottom: 290,
      verdict,
      others: [],
    });
    expect(failures).toEqual([
      "F4.2 verdict line starts 10.0px below the Top_Bar, need at least 16px",
    ]);
  });

  it("names F4.3 when the Ghost covers the question", () => {
    const failures = f4Failures({
      ...DESKTOP,
      ghost: rect(50, 150, 300, 500),
      topBarBottom: 80,
      verdict,
      others: [["question", question]],
    });
    expect(failures).toEqual(["F4.3 the Ghost covers the question"]);
  });
});

describe("failure messages name their requirement ID (T, W, F)", () => {
  it("starts every failure with its row ID", () => {
    const failures = [
      ...t1Failures({ view: null, countdown: null, keep: null, w: 1440, h: 900 }),
      ...t1Failures({
        view: rect(1300, 10, 200, 100),
        countdown: rect(10, 10, 100, 20),
        keep: rect(0, 200, 100, 100),
        w: 1440,
        h: 900,
      }),
      ...tg2Failures({ ghost: rect(0, 0, 100, 100), keep: rect(50, 50, 100, 100) }),
      ...wFailures({
        ...DESKTOP,
        field: null,
        questions: [],
      }),
      ...wFailures({
        ...DESKTOP,
        field: rect(0, 400, 600, 200),
        questions: [],
      }),
      ...w8Failures({ heading: { top: 10 }, topBarBottom: 0 }),
      ...lf1Failures([{ name: "Maya", left: 0, width: 100, leafRights: [10] }]),
      ...lf2Failures({
        items: [
          {
            left: 0,
            top: 0,
            right: 100,
            bottom: 100,
            padding: 10,
            textWidth: 100,
            fontSize: 16,
            lineHeight: 24,
            clipped: false,
          },
        ],
        w: 1440,
      }),
      ...f3Failures({
        ...DESKTOP,
        notice: rect(850, 20, 300, 20),
        labels: [rect(850, 20, 200, 20)],
        question: rect(100, 300, 600, 60),
        answer: rect(100, 400, 600, 80),
        cont: rect(100, 520, 200, 40),
      }),
      ...f4Failures({
        ...DESKTOP,
        ghost: rect(100, 300, 600, 300),
        topBarBottom: 0,
        verdict: rect(100, 5, 600, 20),
        others: [["question", rect(100, 300, 600, 60)]],
      }),
    ];
    expect(failures.length).toBeGreaterThanOrEqual(12);
    for (const f of failures) {
      expect(f).toMatch(/^[TWFL]\d(\.\d+)? /);
    }
  });
});
