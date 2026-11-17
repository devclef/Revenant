import { describe, expect, it } from "vitest";

import {
  landingSealFailures,
  p1Failures,
  rectInViewport,
  rectsSame,
  sealMinPx,
  u8Failures,
} from "../../tools/qa/layout-check.mjs";

/**
 * Unit tests for the U8, LS1 and P1 layout rows (spec 13) in tools/qa/layout-check.mjs.
 * The rows themselves need a browser; these tests cover the pure verdicts they use.
 */

type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
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
});

describe("sealMinPx (U8.1, L1.2)", () => {
  it("sets 160 px at 1440 and 120 px at 390", () => {
    expect(sealMinPx(1440)).toBe(160);
    expect(sealMinPx(390)).toBe(120);
  });

  it("returns null at the other sizes, so no row is measured there", () => {
    expect(sealMinPx(1366)).toBeNull();
    expect(sealMinPx(360)).toBeNull();
  });
});

describe("rectInViewport and rectsSame", () => {
  it("counts a rect inside the viewport, and one touching its edge within rounding", () => {
    expect(rectInViewport(rect(10, 10, 100, 100), 1440, 900)).toBe(true);
    expect(rectInViewport(rect(0, 0, 1440, 900), 1440, 900)).toBe(true);
    expect(rectInViewport(rect(1400, 10, 100, 100), 1440, 900)).toBe(false);
    expect(rectInViewport(rect(10, -5, 100, 100), 1440, 900)).toBe(false);
  });

  it("matches rects within half a pixel and no further", () => {
    expect(rectsSame(rect(0, 100, 50, 50), rect(0.4, 100.4, 50, 50))).toBe(
      true,
    );
    expect(rectsSame(rect(0, 100, 50, 50), rect(0, 101, 50, 50))).toBe(false);
    expect(rectsSame(rect(0, 100, 50, 50), null)).toBe(false);
  });
});

describe("u8Failures (U8.1 to U8.3)", () => {
  const seal = (width: number, left = 100, top = 100) => ({
    ...rect(left, top, width, width),
    width,
  });

  it("passes a 160 px seal at 1440 inside the viewport with its Skip control", () => {
    const failures = u8Failures({
      seal: seal(160),
      skips: [rect(20, 500, 120, 30)],
      minWidth: 160,
      w: 1440,
      h: 900,
    });
    expect(failures).toEqual([]);
  });

  it("fails a seal narrower than the minimum and names U8.3", () => {
    const failures = u8Failures({
      seal: seal(75),
      skips: [],
      minWidth: 160,
      w: 1440,
      h: 900,
    });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(
      /^U8\.3 \(U8\.1\) seal is 75\.0px across, need 160px/,
    );
  });

  it("fails a seal outside the viewport and names U8.2", () => {
    const failures = u8Failures({
      seal: seal(160, 1300, 100),
      skips: [],
      minWidth: 160,
      w: 1440,
      h: 900,
    });
    expect(failures).toEqual(["U8.2 seal is not inside the viewport"]);
  });

  it("fails a Skip control outside the viewport and names U8.2", () => {
    const failures = u8Failures({
      seal: seal(160),
      skips: [rect(20, 950, 120, 30)],
      minWidth: 160,
      w: 1440,
      h: 900,
    });
    expect(failures).toEqual(["U8.2 Skip control is not inside the viewport"]);
  });

  it("reports a missing seal and names U8.3", () => {
    expect(
      u8Failures({ seal: null, skips: [], minWidth: 120, w: 390, h: 844 }),
    ).toEqual(["U8.3 no [data-seal-target] svg to measure"]);
  });
});

describe("landingSealFailures (L1.1 to L1.3)", () => {
  const seal = (width: number, left = 100) => ({
    ...rect(left, 80, width, width),
    width,
  });
  const h1 = rect(100, 300, 600, 80);
  const cta = rect(100, 420, 200, 48);
  const ok = { minWidth: 160, w: 1440, h: 900 };

  it("passes a 160 px seal with the h1 and call to action in the First_Viewport", () => {
    expect(landingSealFailures({ seal: seal(160), h1, cta, ...ok })).toEqual(
      [],
    );
  });

  it("fails a landing seal under 160 px at 1440 and names L1.2", () => {
    const failures = landingSealFailures({ seal: seal(120), h1, cta, ...ok });
    expect(failures).toEqual([
      "L1.2 landing seal is 120.0px across, need 160px",
    ]);
  });

  it("fails a call to action below the fold and names L1.3", () => {
    const failures = landingSealFailures({
      seal: seal(160),
      h1,
      cta: rect(100, 950, 200, 48),
      ...ok,
    });
    expect(failures).toEqual([
      "L1.3 primary call to action is not inside the First_Viewport",
    ]);
  });

  it("fails a landing seal outside the First_Viewport and names L1.1", () => {
    const failures = landingSealFailures({
      seal: seal(160, 1300),
      h1,
      cta,
      ...ok,
    });
    expect(failures).toEqual([
      "L1.1 landing seal is not inside the First_Viewport",
    ]);
  });

  it("fails a missing h1 and names L1.3", () => {
    const failures = landingSealFailures({
      seal: seal(160),
      h1: null,
      cta,
      ...ok,
    });
    expect(failures).toEqual(["L1.3 h1 is not inside the First_Viewport"]);
  });
});

describe("p1Failures (P1.1 to P1.4)", () => {
  const press = {
    tag: "BUTTON",
    left: 500,
    top: 200,
    right: 960,
    bottom: 660,
    width: 460,
    height: 460,
  };
  const warning = rect(40, 300, 400, 90);
  const good = {
    largestIsPress: true,
    press,
    accentCount: 1,
    pressIsAccent: true,
    warningBefore: warning,
    warningDuring: { ...warning },
  };

  it("passes a press that is largest, the only orange control, and leaves the warning still", () => {
    expect(p1Failures(good)).toEqual([]);
  });

  it("fails when another element is larger and names P1.1", () => {
    const failures = p1Failures({ ...good, largestIsPress: false });
    expect(failures).toEqual([
      "P1.1 the Press_Envelope is not the largest element on the step",
    ]);
  });

  it("fails a hit area under 44 px and names P1.2", () => {
    const failures = p1Failures({
      ...good,
      press: { ...press, width: 40, height: 60 },
    });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(
      /^P1\.2 Press_Envelope hit area is 40x60px on a BUTTON/,
    );
  });

  it("fails a press that is not a button and names P1.2", () => {
    const failures = p1Failures({ ...good, press: { ...press, tag: "DIV" } });
    expect(failures[0]).toMatch(/^P1\.2 /);
  });

  it("fails a second orange control or an orange control that is not the press, and names P1.3", () => {
    expect(p1Failures({ ...good, accentCount: 2 })[0]).toMatch(
      /^P1\.3 2 orange control\(s\)/,
    );
    expect(
      p1Failures({ ...good, accentCount: 1, pressIsAccent: false })[0],
    ).toMatch(/^P1\.3 /);
  });

  it("fails when the warning moves during the hold and names P1.4", () => {
    const failures = p1Failures({
      ...good,
      warningDuring: { ...warning, top: 312 },
    });
    expect(failures).toEqual(["P1.4 Warning_Text moved during the hold"]);
  });

  it("fails when the warning is not found and names P1.4", () => {
    expect(p1Failures({ ...good, warningDuring: null })).toEqual([
      "P1.4 Warning_Text not found before or during the hold",
    ]);
  });
});

describe("failure messages name their requirement ID (U8, L1, P1)", () => {
  const ok = { minWidth: 160, w: 1440, h: 900 };
  const h1 = rect(100, 300, 600, 80);
  const cta = rect(100, 420, 200, 48);
  const press = { ...rect(500, 200, 460, 460), tag: "BUTTON", height: 460 };
  const warning = rect(40, 300, 400, 90);
  const pGood = {
    largestIsPress: true,
    press,
    accentCount: 1,
    pressIsAccent: true,
    warningBefore: warning,
    warningDuring: { ...warning },
  };

  it("starts every failure with U8.x, L1.x or P1.x", () => {
    const failures = [
      ...u8Failures({ seal: rect(0, 0, 75, 75), skips: [], ...ok }),
      ...u8Failures({ seal: rect(1300, 100, 160, 160), skips: [], ...ok }),
      ...u8Failures({
        seal: rect(100, 100, 160, 160),
        skips: [rect(20, 950, 120, 30)],
        ...ok,
      }),
      ...landingSealFailures({ seal: null, h1, cta, ...ok }),
      ...landingSealFailures({
        seal: rect(1300, 80, 160, 160),
        h1,
        cta,
        ...ok,
      }),
      ...landingSealFailures({ seal: rect(100, 80, 160, 160), h1: null, cta, ...ok }),
      ...p1Failures({ ...pGood, largestIsPress: false }),
      ...p1Failures({ ...pGood, press: { ...press, tag: "DIV" } }),
      ...p1Failures({ ...pGood, accentCount: 2 }),
      ...p1Failures({ ...pGood, warningDuring: { ...warning, top: 312 } }),
    ];
    expect(failures.length).toBeGreaterThanOrEqual(10);
    for (const f of failures) {
      expect(f).toMatch(/^(U8|L1|P1)\.\d+ /);
    }
  });
});
