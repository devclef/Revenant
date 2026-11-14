import { describe, expect, it } from "vitest";

import { ritualRowVerdict } from "../../tools/qa/layout-check.mjs";

/**
 * Unit tests for the H2.7 threshold in tools/qa/layout-check.mjs: the ritual list on /
 * holds exactly four items in one row at 1440x900.
 */

describe("ritualRowVerdict (H2.7)", () => {
  it("passes four items with the same top", () => {
    const items = [{ top: 400 }, { top: 400 }, { top: 400 }, { top: 400 }];
    expect(ritualRowVerdict(items)).toEqual({ count: 4, rows: 1, ok: true });
  });

  it("treats tops within 1 px as the same row", () => {
    const items = [{ top: 400 }, { top: 400.6 }, { top: 400.2 }, { top: 401 }];
    expect(ritualRowVerdict(items)).toEqual({ count: 4, rows: 1, ok: true });
  });

  it("counts tops more than 1 px apart as a new row", () => {
    const items = [{ top: 400 }, { top: 400 }, { top: 400 }, { top: 402 }];
    expect(ritualRowVerdict(items)).toEqual({ count: 4, rows: 2, ok: false });
  });

  it("fails two rows of two", () => {
    const items = [{ top: 400 }, { top: 400 }, { top: 620 }, { top: 620 }];
    expect(ritualRowVerdict(items)).toEqual({ count: 4, rows: 2, ok: false });
  });

  it("fails a wrapped row of three and one", () => {
    const items = [{ top: 400 }, { top: 400 }, { top: 400 }, { top: 620 }];
    expect(ritualRowVerdict(items)).toEqual({ count: 4, rows: 2, ok: false });
  });

  it("fails one row of five", () => {
    const items = [{ top: 400 }, { top: 400 }, { top: 400 }, { top: 400 }, { top: 400 }];
    expect(ritualRowVerdict(items)).toEqual({ count: 5, rows: 1, ok: false });
  });

  it("fails one row of three", () => {
    const items = [{ top: 400 }, { top: 400 }, { top: 400 }];
    expect(ritualRowVerdict(items)).toEqual({ count: 3, rows: 1, ok: false });
  });

  it("fails when there are no items", () => {
    expect(ritualRowVerdict([])).toEqual({ count: 0, rows: 0, ok: false });
  });

  it("counts rows from the tops regardless of the order given", () => {
    const items = [{ top: 620 }, { top: 400 }, { top: 620 }, { top: 400 }];
    expect(ritualRowVerdict(items)).toEqual({ count: 4, rows: 2, ok: false });
  });
});
