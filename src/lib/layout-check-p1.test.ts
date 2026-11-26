import { describe, expect, it } from "vitest";

import { p1Failures } from "../../tools/qa/layout-check.mjs";

/**
 * P1.3 accepts one orange control on the seal step (the Press_Envelope), or the
 * Press_Envelope plus one orange Seal_Button inside [data-press-column]. These
 * tests cover the pure verdict in tools/qa/layout-check.mjs.
 */

const press = {
  tag: "BUTTON",
  left: 500,
  top: 200,
  right: 960,
  bottom: 660,
  width: 460,
  height: 460,
};
const warning = {
  left: 40,
  top: 300,
  right: 440,
  bottom: 390,
  width: 400,
};
const good = {
  largestIsPress: true,
  press,
  accentCount: 1,
  pressIsAccent: true,
  sealButtonIsAccent: false,
  warningBefore: warning,
  warningDuring: { ...warning },
};

describe("p1Failures P1.3 orange controls", () => {
  it("passes one orange press with no Seal_Button", () => {
    expect(p1Failures(good)).toEqual([]);
  });

  it("passes the press plus an orange Seal_Button", () => {
    expect(
      p1Failures({ ...good, accentCount: 2, sealButtonIsAccent: true }),
    ).toEqual([]);
  });

  it("fails the press plus one more orange control that is not the Seal_Button, naming the count", () => {
    const failures = p1Failures({
      ...good,
      accentCount: 3,
      sealButtonIsAccent: true,
    });
    expect(failures).toEqual([
      "P1.3 3 orange control(s), need 2: the Press_Envelope alone, or the Press_Envelope plus one Seal_Button inside [data-press-column]",
    ]);
  });

  it("fails a second orange control when there is no Seal_Button, naming the count", () => {
    const failures = p1Failures({ ...good, accentCount: 2 });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/^P1\.3 2 orange control\(s\), need 1: /);
  });

  it("fails a Seal_Button when the press is not orange", () => {
    const failures = p1Failures({
      ...good,
      accentCount: 2,
      pressIsAccent: false,
      sealButtonIsAccent: true,
    });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/^P1\.3 2 orange control\(s\), need 2: /);
  });
});
