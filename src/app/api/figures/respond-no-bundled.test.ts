// X3: the 500 path. When a read fails and no series has a bundled figure, the
// fallback is empty, so respondFigures answers 500 {"error":"figures_unavailable"}
// with no-store. The bundled lookup is mocked to return nothing, so this file
// does not depend on which figures the committed fuel-figures.json holds.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/figures/bundled-latest", () => ({
  bundledLatestFigure: () => null,
}));

import type { FigureReadStore } from "./db-response";
import { respondFigures } from "./respond";

const GENERATED = new Date("2026-11-05T15:00:00Z");

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("failed read with no bundled figure", () => {
  it("answers 500 with no-store and the neutral body, and logs one read-step line", async () => {
    const response = await respondFigures("db", {
      readStore: (): FigureReadStore => {
        throw new Error("no DATABASE_URL");
      },
      now: () => GENERATED,
    });

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "figures_unavailable" });
    expect(errorSpy.mock.calls.map((args: unknown[]) => String(args[0]))).toEqual(
      ["figures_unavailable step=read error=Error"],
    );
  });
});
