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

describe("wFailures (W1.1 to W1.3, W3.3, W4.4, W7.2)", () => {
  const goodField = rect(300, 300, 700, 200);
  const goodQuestion = { height: 60, lineHeight: 24, padY: 12 };
  const goodReceipt = { height: 40, lineHeight: 20, padY: 0 };
  const occasion = { height: 32 };

  it("passes a desktop Write step with a 704 px column and a paper within 80 px of it", () => {
    const failures = wFailures({
      ...DESKTOP,
      field: goodField,
      column: 704,
      paper: 760,
      occasions: [occasion],
      questions: [goodQuestion],
      receipts: [goodReceipt],
    });
    expect(failures).toEqual([]);
  });

  it("names W1.1 when the column is wider than 44rem", () => {
    const failures = wFailures({
      ...DESKTOP,
      field: goodField,
      column: 720,
      paper: 720,
      occasions: [],
      questions: [],
      receipts: [],
    });
    expect(failures).toEqual([
      "W1.1 Writing_Column is 720px wide, need at most 704px (44rem)",
    ]);
  });

  it("names W1.2 when the paper is wider than the column plus 80 px", () => {
    const failures = wFailures({
      ...DESKTOP,
      field: goodField,
      column: 600,
      paper: 700,
      occasions: [],
      questions: [],
      receipts: [],
    });
    expect(failures).toEqual([
      "W1.2 paper is 700px wide, need at most the column plus 80px (680px)",
    ]);
  });

  it("names W1.3 when the Letter_Field top is more than 360 px from the top at 1440", () => {
    const failures = wFailures({
      ...DESKTOP,
      field: rect(300, 400, 700, 200),
      column: 600,
      paper: 600,
      occasions: [],
      questions: [],
      receipts: [],
    });
    expect(failures).toEqual([
      "W1.3 Letter_Field top is 400px from the top, need at most 360px",
    ]);
  });

  it("passes W1.3 when the Letter_Field top is exactly 360 px from the top at 1440", () => {
    const failures = wFailures({
      ...DESKTOP,
      field: rect(300, 360, 700, 200),
      column: 600,
      paper: 600,
      occasions: [],
      questions: [],
      receipts: [],
    });
    expect(failures).toEqual([]);
  });

  it("names W1.3 when the Letter_Field top is outside the viewport at 390", () => {
    const failures = wFailures({
      ...PHONE,
      field: rect(20, 900, 350, 200),
      column: 350,
      paper: null,
      occasions: [],
      questions: [],
      receipts: [],
    });
    expect(failures).toEqual([
      "W1.3 Letter_Field top is outside the First_Viewport",
    ]);
  });

  it("uses 32 px for Occasion heights at 1440 and 44 px at 390", () => {
    expect(
      wFailures({
        ...DESKTOP,
        field: goodField,
        column: 600,
        paper: 600,
        occasions: [{ height: 36 }],
        questions: [],
        receipts: [],
      }),
    ).toEqual([]);
    expect(
      wFailures({
        ...PHONE,
        field: rect(20, 100, 350, 200),
        column: 350,
        paper: null,
        occasions: [{ height: 36 }],
        questions: [],
        receipts: [],
      }),
    ).toEqual(["W3.3 Occasion 1 is 36px high, need at least 44px"]);
  });

  it("names W4.4 when a question row is taller than two lines at 1440", () => {
    const failures = wFailures({
      ...DESKTOP,
      field: goodField,
      column: 600,
      paper: 600,
      occasions: [],
      questions: [{ height: 90, lineHeight: 24, padY: 12 }],
      receipts: [],
    });
    expect(failures).toEqual([
      "W4.4 question row 1 is 90px tall, need at most two lines (60px)",
    ]);
  });

  it("names W7.2 for a three-line receipt at 1440 and allows three lines at 390", () => {
    const threeLines = { height: 60, lineHeight: 20, padY: 0 };
    expect(
      wFailures({
        ...DESKTOP,
        field: goodField,
        column: 600,
        paper: 600,
        occasions: [],
        questions: [],
        receipts: [threeLines],
      }),
    ).toEqual(["W7.2 receipt row 1 is 60px tall, need at most 2 lines (40px)"]);
    expect(
      wFailures({
        ...PHONE,
        field: rect(20, 100, 350, 200),
        column: 350,
        paper: null,
        occasions: [],
        questions: [],
        receipts: [threeLines],
      }),
    ).toEqual([]);
  });

  it("reports a missing Letter_Field with the requirement name", () => {
    expect(
      wFailures({
        ...DESKTOP,
        field: null,
        column: 0,
        paper: null,
        occasions: [],
        questions: [],
        receipts: [],
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

describe("f3Failures (F3.1, F3.2, F3.4)", () => {
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
      noticeCount: 1,
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
      noticeCount: 1,
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
      noticeCount: 1,
    });
    expect(failures).toEqual([
      "F3.2 answer control is not inside the First_Viewport",
    ]);
  });

  it("names F3.4 when the notice shows more than once", () => {
    const failures = f3Failures({
      ...DESKTOP,
      notice,
      labels: [],
      question,
      answer,
      cont,
      noticeCount: 2,
    });
    expect(failures).toEqual([
      "F3.4 the fictional notice shows 2 times, need once",
    ]);
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
    ).toEqual(["F4.1 no Ghost drawn on the live Testify step"]);
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
