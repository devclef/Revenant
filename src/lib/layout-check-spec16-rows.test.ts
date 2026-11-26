import { describe, expect, it } from "vitest";

import {
  figureAccentFailures,
  focusHeadingFailures,
  heroLineFailures,
  letterMotionFailures,
  longLetterFailures,
  passkeyWarningFailures,
  placementFailures,
  receiptColumnFailures,
  receiptsOrderFailures,
  receiptsOrderFailuresFolded,
  splitColumnFailures,
  stickyFailures,
} from "../../tools/qa/layout-check.mjs";

/** Unit tests for the spec 16 layout rows of 17.3 in tools/qa/layout-check.mjs. */

const ORDERED = [
  { kind: "pair", top: 100 },
  { kind: "figure", top: 300 },
  { kind: "letter", top: 500 },
  { kind: "seal", top: 700 },
  { kind: "end", top: 800 },
];

describe("row 10.1 receipts order and closed letter", () => {
  it("passes blocks in the order of 10.1 with the letter closed", () => {
    expect(receiptsOrderFailuresFolded({ blocks: ORDERED, letterClosed: true })).toEqual([]);
  });

  it("fails a letter that sits above a figure card", () => {
    const blocks = [
      { kind: "pair", top: 100 },
      { kind: "letter", top: 200 },
      { kind: "figure", top: 400 },
      { kind: "seal", top: 700 },
      { kind: "end", top: 800 },
    ];
    const out = receiptsOrderFailuresFolded({ blocks, letterClosed: true });
    expect(out).toEqual(['10.1 "figure" sits after a later block']);
  });

  it("fails an open letter", () => {
    expect(receiptsOrderFailuresFolded({ blocks: ORDERED, letterClosed: false })).toEqual([
      "10.2 the letter is not folded under Read the letter again",
    ]);
  });

  it("fails when the end card is missing", () => {
    const blocks = ORDERED.filter((b) => b.kind !== "end");
    expect(receiptsOrderFailuresFolded({ blocks, letterClosed: true })).toEqual(['10.1 no "end" block']);
  });
});

describe("row 10.6 live step 6 column", () => {
  it("passes a column centred within 1 px and as wide as the persona column", () => {
    expect(
      receiptColumnFailures({ centre: 720.4, width: 600, viewportCentre: 720, personaWidth: 600.9 }),
    ).toEqual([]);
  });

  it("fails a column 2 px off centre", () => {
    const out = receiptColumnFailures({ centre: 722, width: 600, viewportCentre: 720, personaWidth: 600 });
    expect(out).toHaveLength(1);
    expect(out[0]).toContain("column centre 722 px");
  });

  it("fails a column 3 px narrower than the persona column", () => {
    const out = receiptColumnFailures({ centre: 720, width: 597, viewportCentre: 720, personaWidth: 600 });
    expect(out).toEqual(["10.6 column width 597 px, persona 600 px within 1 px"]);
  });

  it("passes blocks that share the viewport centre", () => {
    const blocks = [
      { kind: "pair", centre: 720.5 },
      { kind: "figure", centre: 719.6 },
      { kind: "letter", centre: 720 },
    ];
    expect(
      receiptColumnFailures({ centre: 720, width: 600, viewportCentre: 720, personaWidth: 600, blocks }),
    ).toEqual([]);
  });

  it("fails a figure card 4 px off the viewport centre", () => {
    const blocks = [
      { kind: "pair", centre: 720 },
      { kind: "figure", centre: 724 },
    ];
    expect(
      receiptColumnFailures({ centre: 720, width: 600, viewportCentre: 720, personaWidth: 600, blocks }),
    ).toEqual(['10.6 "figure" centre 724 px, want 720 px within 1 px']);
  });

  it("fails when there is no persona column to compare with", () => {
    const out = receiptColumnFailures({ centre: 720, width: 600, viewportCentre: 720, personaWidth: null });
    expect(out).toEqual(["10.6 no persona receipts column to compare its width with"]);
  });
});

describe("row 14.3 lost-passkey warning", () => {
  it("passes an unfolded warning inside the viewport above the wax", () => {
    expect(
      passkeyWarningFailures({ unfolded: true, top: 40, bottom: 180, waxTop: 260, viewportH: 900 }),
    ).toEqual([]);
  });

  it("fails a warning whose bottom edge is below the wax top", () => {
    const out = passkeyWarningFailures({ unfolded: true, top: 40, bottom: 300, waxTop: 260, viewportH: 900 });
    expect(out).toEqual(["14.3 warning bottom 300 px is below the wax top 260 px"]);
  });

  it("fails a folded warning", () => {
    const out = passkeyWarningFailures({ unfolded: false, top: 40, bottom: 180, waxTop: 260, viewportH: 900 });
    expect(out).toEqual(["14.3 the lost-passkey warning is folded"]);
  });

  it("fails a warning that runs past the viewport bottom", () => {
    const out = passkeyWarningFailures({ unfolded: true, top: 700, bottom: 950, waxTop: 1000, viewportH: 900 });
    expect(out).toEqual(["14.3 warning 700-950 px is outside the 900 px viewport"]);
  });

  it("fails when the warning is not on the page", () => {
    const out = passkeyWarningFailures({ unfolded: true, top: null, bottom: null, waxTop: 260, viewportH: 900 });
    expect(out).toEqual(["14.3 no lost-passkey warning to measure"]);
  });
});

describe("rows 5.4 and 5.5 hero line boxes", () => {
  it("passes the first sentence on one line at 1440 px", () => {
    expect(heroLineFailures({ w: 1440, firstSentenceLines: 1, lines: [] })).toEqual([]);
  });

  it("fails the first sentence on two lines at 1440 px", () => {
    expect(heroLineFailures({ w: 1440, firstSentenceLines: 2, lines: [] })).toEqual([
      '5.4 "Memory drifts with time." takes 2 line boxes, want 1',
    ]);
  });

  it("passes headline lines of several words at 390 px", () => {
    expect(
      heroLineFailures({ w: 390, firstSentenceLines: 0, lines: ["Memory drifts with", "time. A sealed letter doesn't."] }),
    ).toEqual([]);
  });

  it("fails a headline line that holds one word at 390 px", () => {
    expect(
      heroLineFailures({ w: 390, firstSentenceLines: 0, lines: ["Memory drifts with time.", "doesn't."] }),
    ).toEqual(['5.5 line 2 "doesn\'t." holds one word']);
  });
});
describe("row 10.1 split receipts order (open letter)", () => {
  const SPLIT_BLOCKS = [
    { kind: "pair", top: 100 },
    { kind: "letter", top: 100 },
    { kind: "figure", top: 300 },
    { kind: "seal", top: 700 },
    { kind: "end", top: 800 },
  ];

  it("passes an open letter beside the receipts, in order, with the text visible", () => {
    expect(
      receiptsOrderFailures({ blocks: SPLIT_BLOCKS, disclosurePresent: false, letterTextVisible: true }),
    ).toEqual([]);
  });

  it("fails a letter that sits after the figures", () => {
    const blocks = [
      { kind: "pair", top: 100 },
      { kind: "figure", top: 300 },
      { kind: "letter", top: 500 },
      { kind: "seal", top: 700 },
      { kind: "end", top: 800 },
    ];
    expect(
      receiptsOrderFailures({ blocks, disclosurePresent: false, letterTextVisible: true }),
    ).toEqual(["10.1 the letter sits after the figures"]);
  });

  it("fails when a fold or Read the letter again control is on the page", () => {
    expect(
      receiptsOrderFailures({ blocks: SPLIT_BLOCKS, disclosurePresent: true, letterTextVisible: true }),
    ).toEqual(["10.2 a fold or Read the letter again control is on the page"]);
  });

  it("fails when the letter text is not visible", () => {
    expect(
      receiptsOrderFailures({ blocks: SPLIT_BLOCKS, disclosurePresent: false, letterTextVisible: false }),
    ).toEqual(["10.2 the letter text is not visible"]);
  });
});

describe("row 10.6 split column (open letter beside the receipts)", () => {
  const RECORD = { left: 100, right: 500, top: 100 };
  const LETTER = { left: 520, right: 920, top: 100 };
  const BASE = {
    record: RECORD,
    letter: LETTER,
    width: 400,
    centre: 510,
    viewportCentre: 510,
    personaWidth: 400,
  };

  it("passes side-by-side columns with level tops, centred, and the persona width", () => {
    expect(splitColumnFailures(BASE)).toEqual([]);
  });

  it("accepts a top 1 px apart and a centre 1 px off", () => {
    expect(
      splitColumnFailures({ ...BASE, letter: { ...LETTER, top: 101 }, centre: 511 }),
    ).toEqual([]);
  });

  it("fails when the columns overlap", () => {
    const letter = { left: 480, right: 920, top: 100 };
    expect(splitColumnFailures({ ...BASE, letter })).toEqual([
      "10.6 the record column overlaps the letter column",
    ]);
  });

  it("fails when the column tops are more than 1 px apart", () => {
    expect(splitColumnFailures({ ...BASE, letter: { ...LETTER, top: 105 } })).toEqual([
      "10.6 column tops 100 px and 105 px differ by more than 1 px",
    ]);
  });

  it("fails a column under 280 px wide", () => {
    const letter = { left: 520, right: 790, top: 100 };
    expect(splitColumnFailures({ ...BASE, letter })).toEqual([
      "10.6 the letter column is 270 px, want at least 280 px",
    ]);
  });

  it("fails a centre more than 1 px off the viewport centre", () => {
    expect(splitColumnFailures({ ...BASE, centre: 512 })).toEqual([
      "10.6 column centre 512 px, want 510 px within 1 px",
    ]);
  });

  it("fails a live width more than 1 px from the persona width", () => {
    expect(splitColumnFailures({ ...BASE, width: 402 })).toEqual([
      "10.6 column width 402 px, persona 400 px within 1 px",
    ]);
  });
});
describe("row 10.6 split column with a record box narrower than its grid", () => {
  // The record box is the union of the non-letter blocks, so it can be narrower than the
  // 400 px receipts grid that holds it.
  const LETTER = { left: 520, right: 920, top: 100 };
  const NARROW_RECORD = { left: 120, right: 370, top: 100 };

  it("fails a record union 250 px wide as under 280 px", () => {
    const out = splitColumnFailures({
      record: NARROW_RECORD,
      letter: LETTER,
      width: 250,
      centre: 510,
      viewportCentre: 510,
      personaWidth: 250,
    });
    expect(out).toEqual(["10.6 the record column is 250 px, want at least 280 px"]);
  });

  it("fails a record union 360 px wide against a 400 px persona column", () => {
    const out = splitColumnFailures({
      record: { left: 120, right: 480, top: 100 },
      letter: LETTER,
      width: 360,
      centre: 510,
      viewportCentre: 510,
      personaWidth: 400,
    });
    expect(out).toEqual(["10.6 column width 360 px, persona 400 px within 1 px"]);
  });
});

describe("row S20.c column placement", () => {
  it("passes a wide letter column right of the record column with level tops", () => {
    const record = { left: 100, right: 500, top: 200 };
    const letter = { left: 520, right: 920, top: 200.5 };
    expect(placementFailures({ w: 1280, record, letter, blocks: [] })).toEqual([]);
  });

  it("passes a wide record column narrower than its grid", () => {
    const record = { left: 120, right: 370, top: 200 };
    const letter = { left: 400, right: 920, top: 200 };
    expect(placementFailures({ w: 1280, record, letter, blocks: [] })).toEqual([]);
  });

  it("fails a wide letter column that starts before the record column ends", () => {
    const record = { left: 100, right: 500, top: 200 };
    const letter = { left: 480, right: 920, top: 200 };
    expect(placementFailures({ w: 1280, record, letter, blocks: [] })).toEqual([
      "S20.c letter column starts at 480 px, before the record column ends at 500 px",
    ]);
  });

  it("fails wide columns whose tops differ by more than 1 px", () => {
    const record = { left: 100, right: 500, top: 200 };
    const letter = { left: 520, right: 920, top: 202 };
    expect(placementFailures({ w: 1280, record, letter, blocks: [] })).toEqual([
      "S20.c column tops 200 px and 202 px differ by more than 1 px",
    ]);
  });

  it("fails a wide page with no letter column", () => {
    const record = { left: 100, right: 500, top: 200 };
    expect(placementFailures({ w: 1280, record, letter: null, blocks: [] })).toEqual([
      "S20.c no record or letter column to place",
    ]);
  });

  it("passes narrow blocks stacked in one column", () => {
    const blocks = [
      { kind: "pair", top: 0, bottom: 100 },
      { kind: "figure", top: 100, bottom: 200 },
    ];
    expect(placementFailures({ w: 390, record: null, letter: null, blocks })).toEqual([]);
  });

  it("fails narrow blocks that sit beside each other", () => {
    const blocks = [
      { kind: "pair", top: 0, bottom: 100 },
      { kind: "figure", top: 50, bottom: 150 },
    ];
    expect(placementFailures({ w: 390, record: null, letter: null, blocks })).toEqual([
      'S20.c "figure" sits beside "pair" in one column',
    ]);
  });
});

describe("row S20.d letter sticks under the Top_Bar", () => {
  it("passes a letter top 0 to 32 px under the Top_Bar", () => {
    expect(
      stickyFailures({ top: 40, barBottom: 20, areaBottom: 3000, letterBottom: 2400 }),
    ).toEqual([]);
  });

  it("passes a letter top at the Top_Bar edge, within 1 px", () => {
    expect(
      stickyFailures({ top: 19.5, barBottom: 20, areaBottom: 3000, letterBottom: 2400 }),
    ).toEqual([]);
  });

  it("fails a letter top above the Top_Bar", () => {
    expect(
      stickyFailures({ top: 10, barBottom: 20, areaBottom: 3000, letterBottom: 2400 }),
    ).toEqual(["S20.d letter top 10 px, want 20 to 52 px"]);
  });

  it("fails a letter top more than 32 px under the Top_Bar", () => {
    expect(
      stickyFailures({ top: 80, barBottom: 20, areaBottom: 3000, letterBottom: 2400 }),
    ).toEqual(["S20.d letter top 80 px, want 20 to 52 px"]);
  });

  it("passes a letter top once the receipts end has reached the letter bottom", () => {
    expect(
      stickyFailures({ top: -300, barBottom: 20, areaBottom: 500, letterBottom: 500 }),
    ).toEqual([]);
  });

  it("fails when no letter column is on the page", () => {
    expect(
      stickyFailures({ top: null, barBottom: 20, areaBottom: 3000, letterBottom: 2400 }),
    ).toEqual(["S20.d no letter column or Top_Bar to measure"]);
  });
});

describe("row S20.e focused heading in view", () => {
  it("passes a heading between the Top_Bar and the viewport bottom", () => {
    expect(focusHeadingFailures({ top: 100, bottom: 140, barBottom: 56, viewportH: 900 })).toEqual([]);
  });

  it("passes a heading top 0.5 px above the Top_Bar bottom, within 1 px", () => {
    expect(focusHeadingFailures({ top: 55.5, bottom: 90, barBottom: 56, viewportH: 900 })).toEqual([]);
  });

  it("fails a heading top above the Top_Bar bottom", () => {
    expect(focusHeadingFailures({ top: 40, bottom: 80, barBottom: 56, viewportH: 900 })).toEqual([
      "S20.e heading top 40 px is above the Top_Bar bottom 56 px",
    ]);
  });

  it("fails a heading bottom below the viewport", () => {
    expect(focusHeadingFailures({ top: 860, bottom: 950, barBottom: 56, viewportH: 900 })).toEqual([
      "S20.e heading bottom 950 px is below the 900 px viewport",
    ]);
  });

  it("fails when the heading is not on the page", () => {
    expect(focusHeadingFailures({ top: null, bottom: null, barBottom: 56, viewportH: 900 })).toEqual([
      "S20.e no Figures_Heading or Top_Bar to measure",
    ]);
  });
});

describe("row S20.f letter motion", () => {
  it("passes one animate call on the letter with the same node kept", () => {
    expect(letterMotionFailures({ reduced: false, calls: 1, nodeKept: true, animations: 3 })).toEqual([]);
  });

  it("fails two animate calls on the letter", () => {
    expect(letterMotionFailures({ reduced: false, calls: 2, nodeKept: true, animations: 3 })).toEqual([
      "S20.f 2 animate calls on the letter, want at most 1 (its unfold)",
    ]);
  });

  it("fails when the letter node changed after the move", () => {
    expect(letterMotionFailures({ reduced: false, calls: 0, nodeKept: false, animations: 0 })).toEqual([
      "S20.f the letter node held before the move is not the one shown 2,000 ms after it",
    ]);
  });

  it("fails when no animate count was recorded", () => {
    expect(letterMotionFailures({ reduced: false, calls: null, nodeKept: true, animations: 0 })).toEqual([
      "S20.f no animate count was recorded",
    ]);
  });

  it("passes reduced motion with no animate call and no animation", () => {
    expect(letterMotionFailures({ reduced: true, calls: 0, nodeKept: true, animations: 0 })).toEqual([]);
  });

  it("fails reduced motion with an animate call and an animation", () => {
    expect(letterMotionFailures({ reduced: true, calls: 1, nodeKept: true, animations: 2 })).toEqual([
      "S20.f-reduced 1 animate call(s) on the letter, want 0",
      "S20.f-reduced 2 animation(s) on the letter subtree, want 0",
    ]);
  });
});

describe("row S20.g figure accent", () => {
  const ACCENT = "rgb(255, 122, 0)";

  it("passes figure text drawn in colours other than --accent", () => {
    const colours = [
      { label: "fuel value", colour: "rgb(255, 255, 255)" },
      { label: "change line", colour: "rgb(200, 200, 200)" },
    ];
    expect(figureAccentFailures({ accent: ACCENT, colours })).toEqual([]);
  });

  it("fails a figure label drawn in --accent", () => {
    const colours = [
      { label: "fuel value", colour: "rgb(255, 255, 255)" },
      { label: "period", colour: ACCENT },
    ];
    expect(figureAccentFailures({ accent: ACCENT, colours })).toEqual([
      'S20.g "period" is drawn in --accent',
    ]);
  });

  it("fails when no --accent token is found", () => {
    expect(figureAccentFailures({ accent: null, colours: [] })).toEqual([
      "S20.g no --accent token to compare with",
    ]);
  });
});

describe("row S20.long long letter column", () => {
  const PASS = { tabindex: "0", overflowing: true, scrolledBy: 320, lastCharVisible: true };

  it("passes a focusable column that scrolls and shows its last character", () => {
    expect(longLetterFailures(PASS)).toEqual([]);
  });

  it("fails a column with no tabindex", () => {
    expect(longLetterFailures({ ...PASS, tabindex: null })).toEqual([
      'S20.long the letter column has tabindex none, want "0"',
    ]);
  });

  it("fails a column that does not overflow at 1280x800", () => {
    expect(longLetterFailures({ ...PASS, overflowing: false, scrolledBy: 0 })).toEqual([
      "S20.long the letter column does not scroll on its own at 1280x800",
    ]);
  });

  it("fails when End does not scroll the column", () => {
    expect(longLetterFailures({ ...PASS, scrolledBy: 0 })).toEqual([
      "S20.long End did not scroll the letter column",
    ]);
  });

  it("fails when the last character is not in view after End", () => {
    expect(longLetterFailures({ ...PASS, lastCharVisible: false })).toEqual([
      "S20.long the last character of the letter is not in view after End",
    ]);
  });
});
