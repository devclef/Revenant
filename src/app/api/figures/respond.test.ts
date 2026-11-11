// Tests for the failure log line and the fallback answer in respond.ts (issues #313, #337).
// They drive respondFigures with stub read stores and check which step failed,
// the one console.error line, and that no connection string reaches the log,
// the body or the headers.
//
// The stores here hold no figures. No test touches a database or the network.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bundledLatestFigure } from "@/lib/figures/bundled-latest";
import { CATALOGUE } from "@/lib/figures/catalogue";
import { isFixtureFigure } from "@/lib/figures/fixture";

import type { FigureReadStore, StoredFigureRow } from "./db-response";
import { figuresFailureLine, fallbackResponse, respondFigures } from "./respond";

const GENERATED = new Date("2026-11-05T15:00:00Z");
const SECRET_URL = "postgres://user:secret@host/db";

/** A store whose two reads answer with the given values, or fail with the given error. */
function store(options: {
  latest?: () => Promise<readonly StoredFigureRow[]>;
  success?: () => Promise<ReadonlyMap<string, Date>>;
}): FigureReadStore {
  return {
    latestFigures: options.latest ?? (async () => []),
    lastSuccessTimes: options.success ?? (async () => new Map<string, Date>()),
  };
}

function withCode(message: string, code: unknown): Error {
  return Object.assign(new Error(message), { code });
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function loggedLines(): string[] {
  return errorSpy.mock.calls.map((args: unknown[]) => String(args[0]));
}

async function failingRespond(readStore: () => FigureReadStore) {
  return respondFigures("db", { readStore, now: () => GENERATED });
}

describe("failure step label", () => {
  it("logs step=read when readStore() throws", async () => {
    const response = await failingRespond(() => {
      throw new Error("no DATABASE_URL");
    });

    // X3: a failed read answers the bundled fallback (200), not 500. The log line is unchanged.
    expect(response.status).toBe(200);
    expect(loggedLines()).toEqual(["figures_unavailable step=read error=Error"]);
  });

  it("logs step=read when latestFigures() rejects", async () => {
    const response = await failingRespond(() =>
      store({ latest: () => Promise.reject(new Error("latest failed")) }),
    );

    // X3: a failed read answers the bundled fallback (200), not 500. The log line is unchanged.
    expect(response.status).toBe(200);
    expect(loggedLines()).toEqual(["figures_unavailable step=read error=Error"]);
  });

  it("logs step=read when lastSuccessTimes() rejects", async () => {
    const response = await failingRespond(() =>
      store({ success: () => Promise.reject(new Error("runs failed")) }),
    );

    // X3: a failed read answers the bundled fallback (200), not 500. The log line is unchanged.
    expect(response.status).toBe(200);
    expect(loggedLines()).toEqual(["figures_unavailable step=read error=Error"]);
  });

  it("skips a row with an invalid retrieved_at, answers 200, and logs one figures_row_skipped line", async () => {
    // An invalid retrieved_at no longer throws in the shape step: the row is
    // skipped and its metric is logged once, so the route still answers 200.
    const badRow: StoredFigureRow = {
      metric_id: "us-gasoline-regular",
      kind: "official",
      value: "1.0",
      unit: "USD per gallon",
      region: "U.S.",
      period: "2026-10-05",
      source: "U.S. EIA",
      series_id: "EMM_EPMR_PTE_NUS_DPG",
      source_url: "https://test.invalid/fake-figure",
      retrieved_at: new Date(Number.NaN),
    };

    const response = await failingRespond(() =>
      store({ latest: async () => [badRow] }),
    );

    expect(response.status).toBe(200);
    expect(loggedLines()).toEqual([
      "figures_row_skipped metric_id=us-gasoline-regular",
    ]);
  });
});

describe("failure code label", () => {
  it("logs the Postgres code when the error carries a string code", async () => {
    const response = await failingRespond(() =>
      store({
        latest: () => Promise.reject(withCode("relation missing", "42P01")),
      }),
    );

    // X3: a failed read answers the bundled fallback (200), not 500. The log line is unchanged.
    expect(response.status).toBe(200);
    expect(loggedLines()).toEqual([
      "figures_unavailable step=read error=Error code=42P01",
    ]);
  });

  it("logs no code when the error has no code", async () => {
    await failingRespond(() =>
      store({ latest: () => Promise.reject(new Error("plain failure")) }),
    );

    const [line] = loggedLines();
    expect(line).toBe("figures_unavailable step=read error=Error");
    expect(line).not.toMatch(/code=/);
  });

  it("logs no code when the code is not a string", async () => {
    await failingRespond(() =>
      store({ latest: () => Promise.reject(withCode("numeric code", 42)) }),
    );

    expect(loggedLines()).toEqual(["figures_unavailable step=read error=Error"]);
  });

  it("builds the line from the step, name and string code only", () => {
    expect(figuresFailureLine("read", new TypeError("x"))).toBe(
      "figures_unavailable step=read error=TypeError",
    );
    expect(figuresFailureLine("shape", withCode("x", "23505"))).toBe(
      "figures_unavailable step=shape error=Error code=23505",
    );
    expect(figuresFailureLine("read", "not an error")).toBe(
      "figures_unavailable step=read error=string",
    );
  });
});

describe("secret redaction", () => {
  it("keeps a connection string out of the logged line, the body and the headers", async () => {
    const response = await failingRespond(() =>
      store({
        latest: () =>
          Promise.reject(new Error(`connect ECONNREFUSED ${SECRET_URL}`)),
      }),
    );
    const text = await response.text();

    const lines = loggedLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain("secret");
    expect(lines[0]).not.toContain("postgres");
    expect(lines[0]).not.toContain("user:");

    expect(text).not.toContain("secret");
    expect(text).not.toContain("postgres");
    // X3: the body is the fallback, not an error. It must still carry no secret.
    expect(JSON.parse(text)).toEqual(
      fallbackResponse("2026-11-05T15:00:00Z"),
    );

    for (const [name, value] of response.headers.entries()) {
      expect(name, name).not.toMatch(/secret|postgres/i);
      expect(value, name).not.toMatch(/secret|postgres/i);
    }
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("keeps the connection string out of the log when readStore() throws it", async () => {
    const response = await failingRespond(() => {
      throw new Error(SECRET_URL);
    });
    const text = await response.text();

    expect(loggedLines().join("\n")).not.toContain("secret");
    expect(text).not.toContain("secret");
  });
});

describe("one line per failure", () => {
  it("logs exactly one line for each failure kind", async () => {
    const cases: Array<[string, () => FigureReadStore]> = [
      [
        "readStore throws",
        () => {
          throw new Error("x");
        },
      ],
      [
        "latestFigures rejects",
        () => store({ latest: () => Promise.reject(new Error("x")) }),
      ],
      [
        "lastSuccessTimes rejects",
        () => store({ success: () => Promise.reject(new Error("x")) }),
      ],
    ];

    for (const [label, readStore] of cases) {
      errorSpy.mockClear();
      const response = await failingRespond(readStore);
      // X3: a failed read answers the bundled fallback (200), not 500.
      expect(response.status, label).toBe(200);
      expect(loggedLines(), label).toHaveLength(1);
      expect(loggedLines()[0], label).not.toContain("\n");
    }
  });
});

// --- fallbackResponse (X3): bundled figures only, never invented -----------

describe("fallbackResponse", () => {
  it("lists every catalogue series in catalogue order with last_success_at null", () => {
    const body = fallbackResponse("2026-11-05T15:00:00Z");

    expect(body.series.map((entry) => entry.metric.id)).toEqual(
      CATALOGUE.map((series) => series.metric.id),
    );
    for (const entry of body.series) {
      expect(entry.last_success_at).toBeNull();
    }
  });

  it("Property 1 (fallback part): each figure is the bundled figure field for field, marked fallback, and nothing is invented", () => {
    const body = fallbackResponse("2026-11-05T15:00:00Z");

    for (const series of CATALOGUE) {
      const entry = body.series.find((e) => e.metric.id === series.metric.id);
      const bundled = bundledLatestFigure(series);

      expect(entry, series.metric.id).toBeDefined();
      expect(entry?.figure, series.metric.id).toEqual(bundled);
      if (bundled === null) {
        expect(entry?.fallback ?? false, series.metric.id).toBe(false);
      } else {
        expect(entry?.fallback, series.metric.id).toBe(true);
        expect(isFixtureFigure(entry!.figure!), series.metric.id).toBe(false);
      }
    }
  });

  it("uses the generated_at it was given and the revenant-figures-v1 format", () => {
    const body = fallbackResponse("2026-11-05T15:00:00Z");

    expect(body.format).toBe("revenant-figures-v1");
    expect(body.generated_at).toBe("2026-11-05T15:00:00Z");
  });
});
