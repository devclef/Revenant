import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  CT1_SIZES,
  creamRunPx,
  readSf1Reading,
  sfFailures,
  ttFailures,
  SF1_RATIO,
  TT1_MIN_PX,
} from "../../tools/qa/layout-rules-17.mjs";
import { checkSf1Tt1, makeReport, SF1_TT1_SIZES } from "../../tools/qa/layout-check.mjs";

// SF1 (GitHub issue #587): the Seal panel fills at least 99% of its surface, with no cream strip beside it.
describe("SF1 Seal panel fills its surface", () => {
  it("fails the main-build panel of 1040 px in a 1360 px surface", () => {
    const failures = sfFailures({ panelWidth: 1040, surfaceWidth: 1360, creamRun: 0 });
    expect(failures).toHaveLength(1);
    expect(failures[0].id).toBe("SF1");
    expect(failures[0].check).toBe("panel-width");
    expect(failures[0].message).toContain("1040 px");
    expect(failures[0].message).toContain("1360 px");
  });

  it("passes when the panel is equal to the surface width", () => {
    expect(sfFailures({ panelWidth: 1360, surfaceWidth: 1360, creamRun: 0 })).toEqual([]);
  });

  it("passes a panel at exactly 99% of the surface", () => {
    expect(sfFailures({ panelWidth: 990, surfaceWidth: 1000, creamRun: 0 })).toEqual([]);
  });

  it("fails a panel just under 99% of the surface", () => {
    const failures = sfFailures({ panelWidth: 989, surfaceWidth: 1000, creamRun: 0 });
    expect(failures.map((f) => f.check)).toEqual(["panel-width"]);
  });

  it("fails a cream strip wider than 2 px beside the panel", () => {
    const failures = sfFailures({ panelWidth: 1360, surfaceWidth: 1360, creamRun: 3 });
    expect(failures.map((f) => f.check)).toEqual(["cream-strip"]);
  });

  it("passes a cream run of exactly 2 px", () => {
    expect(sfFailures({ panelWidth: 1360, surfaceWidth: 1360, creamRun: 2 })).toEqual([]);
  });

  it("fails when a measurement is missing", () => {
    const failures = sfFailures({ panelWidth: null, surfaceWidth: 1360, creamRun: null });
    expect(failures).toHaveLength(1);
    expect(failures[0].message).toContain("no [data-seal-step]");
  });

  it("fails exactly when the panel is under 99% of the surface (property)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5000 }), fc.integer({ min: 1, max: 5000 }), (panelWidth, surfaceWidth) => {
        const failures = sfFailures({ panelWidth, surfaceWidth, creamRun: 0 });
        const underRatio = panelWidth < SF1_RATIO * surfaceWidth;
        expect(failures.some((f) => f.check === "panel-width")).toBe(underRatio);
      }),
    );
  });
});

// TT1 (GitHub issue #587): the visible wax mark is at least 44 px square at rest.
describe("TT1 wax mark meets the target size", () => {
  it("fails a 15 x 15 px wax mark at 1440x900", () => {
    const failures = ttFailures({ targets: [{ label: "Press the seal", wax: { width: 15, height: 15 } }] });
    expect(failures).toHaveLength(1);
    expect(failures[0].id).toBe("TT1");
    expect(failures[0].check).toBe("wax-target-size");
    expect(failures[0].message).toContain("15 x 15 px");
  });

  it("fails a 10 x 10 px wax mark at 390x844", () => {
    const failures = ttFailures({ targets: [{ label: "Press the seal", wax: { width: 10, height: 10 } }] });
    expect(failures).toHaveLength(1);
    expect(failures[0].message).toContain("10 x 10 px");
  });

  it("passes a wax mark of 392 x 253 px on its own", () => {
    expect(ttFailures({ targets: [{ label: "Press the seal", wax: { width: 392, height: 253 } }] })).toEqual([]);
  });

  it("passes a wax mark of at least 60 x 60 px", () => {
    expect(ttFailures({ targets: [{ label: "Press the seal", wax: { width: 60, height: 60 } }] })).toEqual([]);
  });

  it("passes a wax mark of exactly 44 x 44 px", () => {
    expect(ttFailures({ targets: [{ label: "Press the seal", wax: { width: TT1_MIN_PX, height: TT1_MIN_PX } }] })).toEqual([]);
  });

  it("fails a wax mark of 43 px in one dimension", () => {
    const failures = ttFailures({ targets: [{ label: "Press the seal", wax: { width: 44, height: 43 } }] });
    expect(failures.map((f) => f.check)).toEqual(["wax-target-size"]);
  });

  it("fails a target with no measurable wax mark", () => {
    const failures = ttFailures({ targets: [{ label: "Press the seal", wax: null }] });
    expect(failures).toHaveLength(1);
    expect(failures[0].message).toContain("no [data-wax] mark measured");
  });

  it("fails when no press target is found", () => {
    const failures = ttFailures({ targets: [] });
    expect(failures).toHaveLength(1);
    expect(failures[0].message).toContain("no [data-press-target]");
  });
});

// Wiring: checkSf1Tt1 runs at SF1_TT1_SIZES only. The fake page answers each reader's script from the
// marker it contains: READ_TT1 names [data-press-target], READ_SF1 does not.
describe("SF1 and TT1 size gate on Press the seal", () => {
  function fakePage(calls: string[]) {
    return {
      evaluate: async (fn: (...args: unknown[]) => unknown) => {
        if (String(fn).includes("data-press-target")) {
          calls.push("tt1");
          return [{ label: "Press the seal", wax: { width: 392, height: 253 } }];
        }
        calls.push("sf1");
        return null;
      },
    };
  }

  function ctxFor(size: string) {
    const rep = makeReport(() => {});
    rep.setContext({ size, stage: "Press the seal", persona: null });
    return { size, rep };
  }

  it("lists the three SF1 and TT1 sizes", () => {
    expect(SF1_TT1_SIZES).toEqual(["1440x900", "390x844", "360x640"]);
  });

  it("keeps 1440x900 as an SF1-only size outside the CT1 sizes", () => {
    expect(CT1_SIZES).toEqual(["390x844", "360x640"]);
    expect(SF1_TT1_SIZES.filter((size) => !CT1_SIZES.includes(size))).toEqual(["1440x900"]);
  });

  it.each(["1440x900", "390x844", "360x640"])("evaluates SF1 and TT1 at %s", async (size) => {
    const calls: string[] = [];
    const ctx = ctxFor(size);
    await checkSf1Tt1(fakePage(calls) as never, ctx as never);
    expect(calls).toEqual(["sf1", "tt1"]);
    // The fake page has no Seal panel, so SF1 reports a missing measurement and TT1 passes.
    expect(ctx.rep.items.map((row: { check: string; name: string }) => [row.check, row.name])).toEqual([
      ["SF1", "panel-fills-surface"],
    ]);
  });

  it("skips SF1 and TT1 at a size that neither gate owns", async () => {
    const calls: string[] = [];
    const ctx = ctxFor("800x600");
    await checkSf1Tt1(fakePage(calls) as never, ctx as never);
    expect(calls).toEqual([]);
    expect(ctx.rep.items).toEqual([]);
  });
});

// readSf1Reading and its cream-strip reader, creamRunPx. The pixel rows are small RGBA fixtures.
describe("readSf1Reading cream strip", () => {
  const CREAM = [246, 234, 212, 255];
  const INK = [31, 27, 22, 255];
  const rowOf = (...pixels: number[][]) => pixels.flat();

  it("finds a 3 px cream run beside the panel", () => {
    expect(creamRunPx(rowOf(INK, CREAM, CREAM, CREAM, INK), 0, 0)).toBe(3);
  });

  it("breaks the run at the panel's pixels", () => {
    // Five cream pixels with the panel over x = 1 and 2 leave runs of 1 and 2.
    const row = rowOf(CREAM, CREAM, CREAM, CREAM, CREAM);
    expect(creamRunPx(row, 1, 3)).toBe(2);
  });

  it("counts a channel 8 steps off cream as cream and 9 steps off as not", () => {
    expect(creamRunPx(rowOf([254, 234, 212, 255]), 0, 0)).toBe(1);
    expect(creamRunPx(rowOf([255, 234, 212, 255]), 0, 0)).toBe(0);
  });

  it("returns null measurements when the page has no Seal panel", async () => {
    const page = { evaluate: async () => null };
    expect(await readSf1Reading(page as never)).toEqual({ panelWidth: null, surfaceWidth: null, creamRun: null });
  });

  it("returns no cream run when the panel's middle is above the viewport", async () => {
    const page = {
      evaluate: async () => ({
        panel: { left: 100, top: -500, right: 1100, bottom: -400, width: 1000, height: 100 },
        surface: { left: 0, top: -500, right: 1200, bottom: -400, width: 1200, height: 100 },
        viewport: { width: 1200, height: 800 },
      }),
    };
    expect(await readSf1Reading(page as never)).toEqual({ panelWidth: 1000, surfaceWidth: 1200, creamRun: null });
  });
});
