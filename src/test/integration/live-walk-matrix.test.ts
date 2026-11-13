import { describe, expect, it } from "vitest";

import { WALK_STEP_NAMES } from "./live-walk-helpers";
import { WALK_MATRIX, matrixShotNames, walkEnabled } from "./live-walk-matrix";

describe("WALK_MATRIX", () => {
  it("has six runs: no figure, one figure and one reduced run at each width", () => {
    expect(WALK_MATRIX).toHaveLength(6);
  });

  it("covers both widths with the expected variants", () => {
    const at = (width: number) =>
      WALK_MATRIX.filter((e) => e.width === width).map((e) => ({
        variant: e.variant,
        reduced: e.reduced,
      }));
    expect(at(1440)).toEqual([
      { variant: "no-figure", reduced: false },
      { variant: "one-figure", reduced: false },
      { variant: "one-figure", reduced: true },
    ]);
    expect(at(390)).toEqual(at(1440));
    expect(WALK_MATRIX.map((e) => [e.width, e.height])).toEqual([
      [1440, 900],
      [1440, 900],
      [1440, 900],
      [390, 844],
      [390, 844],
      [390, 844],
    ]);
  });

  it("gives every run a unique id", () => {
    const ids = WALK_MATRIX.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("lists one Step_Shot per walk step for each run", () => {
    for (const entry of WALK_MATRIX) {
      const names = matrixShotNames(entry);
      expect(names).toHaveLength(WALK_STEP_NAMES.length);
      for (const name of names) {
        expect(name).toMatch(
          entry.reduced
            ? /^live-\d{2}-[a-z-]+-\d+x\d+-reduced\.png$/
            : /^live-\d{2}-[a-z-]+-\d+x\d+\.png$/,
        );
        expect(name).toContain(`-${entry.width}x${entry.height}`);
      }
    }
  });
});

describe("walkEnabled", () => {
  it("is false when WALK is unset, so the replay is skipped", () => {
    expect(walkEnabled({})).toBe(false);
  });

  it("is false for any value other than exactly 1", () => {
    expect(walkEnabled({ WALK: "" })).toBe(false);
    expect(walkEnabled({ WALK: "true" })).toBe(false);
    expect(walkEnabled({ WALK: "0" })).toBe(false);
  });

  it("is true only when WALK is 1", () => {
    expect(walkEnabled({ WALK: "1" })).toBe(true);
  });
});
