// Example tests for the then-and-now lookup (spec 02-demo-figures, Task 2).
//
// These are the worked examples from the ticket. Fixture-series examples load
// the US fuel fixture through loadFigureFile on its own; examples about the
// demo itself (a real catalogue series) run against DEMO_FIGURES. No network,
// no database.

import { describe, expect, it } from "vitest";

import { thenAndNow } from "./then-now";
import { DEMO_FIGURES } from "./demo";
import { CATALOGUE } from "./catalogue";
import { loadFigureFile } from "./load";
import fixture from "./demo/us-fuel.fixture.json";
import type { Found, Missing } from "./types";

// The fixture validated against the real catalogue, as DEMO_FIGURES does for
// its fixture half. Fixture-ID examples read from here.
const FIXTURE_FIGURES = loadFigureFile(fixture, CATALOGUE);

// Type guards that narrow a result and fail the test loudly if the branch is
// wrong, so the value assertions below read cleanly.
function assertFound(r: Found | Missing): asserts r is Found {
  if (!r.found) {
    throw new Error(`expected a found figure, got missing: ${r.reason}`);
  }
}
function assertMissing(r: Found | Missing): asserts r is Missing {
  if (r.found) {
    throw new Error("expected a missing result, got a found figure");
  }
}

describe("thenAndNow on the fixture figures", () => {
  it("gasoline at 2024-11-05: then 3.00 (2024-11-04), now 5.00 (2026-10-26)", () => {
    const { then, now } = thenAndNow(
      "fixture-us-gasoline-regular",
      "2024-11-05",
      FIXTURE_FIGURES,
    );
    assertFound(then);
    assertFound(now);
    expect(then.figure.value).toBe("3.00");
    expect(then.figure.period).toBe("2024-11-04");
    expect(now.figure.value).toBe("5.00");
    expect(now.figure.period).toBe("2026-10-26");
  });

  it("diesel at 2024-11-05: then 8.00 (2024-11-04), now 6.00 (2026-10-26)", () => {
    const { then, now } = thenAndNow(
      "fixture-us-diesel",
      "2024-11-05",
      FIXTURE_FIGURES,
    );
    assertFound(then);
    assertFound(now);
    expect(then.figure.value).toBe("8.00");
    expect(then.figure.period).toBe("2024-11-04");
    expect(now.figure.value).toBe("6.00");
    expect(now.figure.period).toBe("2026-10-26");
  });

  it("before the first figure: then is none_at_or_before_date, now is still found", () => {
    const gasoline = thenAndNow(
      "fixture-us-gasoline-regular",
      "2023-10-01",
      FIXTURE_FIGURES,
    );
    assertMissing(gasoline.then);
    assertFound(gasoline.now);
    expect(gasoline.then.reason).toBe("none_at_or_before_date");
    expect(gasoline.now.figure.value).toBe("5.00");

    const diesel = thenAndNow("fixture-us-diesel", "2023-10-01", FIXTURE_FIGURES);
    assertMissing(diesel.then);
    assertFound(diesel.now);
    expect(diesel.then.reason).toBe("none_at_or_before_date");
    expect(diesel.now.figure.value).toBe("6.00");
  });

  it("a real catalogue series id has a real figure at the date in the demo figures", () => {
    const { then, now } = thenAndNow(
      "us-gasoline-regular",
      "2024-11-05",
      DEMO_FIGURES,
    );
    assertFound(then);
    assertFound(now);
    expect(then.figure.period).toBe("2024-11-04");
    expect(then.figure.value).toBe("3.069");
    expect(now.figure.period).toBe("2026-10-26");
    expect(now.figure.value).toBe("4.269");
  });

  it("an unknown series id: unknown_series for both", () => {
    const { then, now } = thenAndNow(
      "not-a-real-series",
      "2024-11-05",
      DEMO_FIGURES,
    );
    assertMissing(then);
    assertMissing(now);
    expect(then.reason).toBe("unknown_series");
    expect(now.reason).toBe("unknown_series");
  });

  it("a non-date string throws RangeError", () => {
    expect(() =>
      thenAndNow("fixture-us-gasoline-regular", "not-a-date", FIXTURE_FIGURES),
    ).toThrow(RangeError);
    expect(() =>
      thenAndNow("fixture-us-gasoline-regular", "2024-13-01", FIXTURE_FIGURES),
    ).toThrow(RangeError);
  });

  it("returns the exact frozen figure reference held in the data", () => {
    const { now } = thenAndNow(
      "fixture-us-gasoline-regular",
      "2026-10-26",
      FIXTURE_FIGURES,
    );
    assertFound(now);
    const series = FIXTURE_FIGURES.series.get("fixture-us-gasoline-regular");
    expect(series).toBeDefined();
    const last = series!.figures[series!.figures.length - 1];
    // Same object, not a copy: the lookup never clones or rebuilds a figure.
    expect(now.figure).toBe(last);
  });
});
