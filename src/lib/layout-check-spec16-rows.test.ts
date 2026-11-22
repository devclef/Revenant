import { describe, expect, it } from "vitest";

import {
  heroLineFailures,
  passkeyWarningFailures,
  receiptColumnFailures,
  receiptsOrderFailures,
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
    expect(receiptsOrderFailures({ blocks: ORDERED, letterClosed: true })).toEqual([]);
  });

  it("fails a letter that sits above a figure card", () => {
    const blocks = [
      { kind: "pair", top: 100 },
      { kind: "letter", top: 200 },
      { kind: "figure", top: 400 },
      { kind: "seal", top: 700 },
      { kind: "end", top: 800 },
    ];
    const out = receiptsOrderFailures({ blocks, letterClosed: true });
    expect(out).toEqual(['10.1 "figure" sits after a later block']);
  });

  it("fails an open letter", () => {
    expect(receiptsOrderFailures({ blocks: ORDERED, letterClosed: false })).toEqual([
      "10.2 the letter is not folded under Read the letter again",
    ]);
  });

  it("fails when the end card is missing", () => {
    const blocks = ORDERED.filter((b) => b.kind !== "end");
    expect(receiptsOrderFailures({ blocks, letterClosed: true })).toEqual(['10.1 no "end" block']);
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
