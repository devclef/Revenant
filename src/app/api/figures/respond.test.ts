// Tests for the failure log line and the 500 answer in respond.ts (issue #313).
// They drive respondFigures with stub read stores and check which step failed,
// the one console.error line, and that no connection string reaches the log,
// the body or the headers.
//
// The stores here hold no figures. No test touches a database or the network.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FigureReadStore, StoredFigureRow } from "./db-response";
import { figuresFailureLine, respondFigures } from "./respond";

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

    expect(response.status).toBe(500);
    expect(loggedLines()).toEqual(["figures_unavailable step=read error=Error"]);
  });

  it("logs step=read when latestFigures() rejects", async () => {
    const response = await failingRespond(() =>
      store({ latest: () => Promise.reject(new Error("latest failed")) }),
    );

    expect(response.status).toBe(500);
    expect(loggedLines()).toEqual(["figures_unavailable step=read error=Error"]);
  });

  it("logs step=read when lastSuccessTimes() rejects", async () => {
    const response = await failingRespond(() =>
      store({ success: () => Promise.reject(new Error("runs failed")) }),
    );

    expect(response.status).toBe(500);
    expect(loggedLines()).toEqual(["figures_unavailable step=read error=Error"]);
  });

  it("logs step=shape when the shaping step throws", async () => {
    // An invalid retrieved_at makes toISOString throw a RangeError inside the
    // shape step. The read step only passes the row through, so the failure is
    // in shaping.
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

    expect(response.status).toBe(500);
    expect(loggedLines()).toEqual(["figures_unavailable step=shape error=RangeError"]);
  });
});

describe("failure code label", () => {
  it("logs the Postgres code when the error carries a string code", async () => {
    const response = await failingRespond(() =>
      store({
        latest: () => Promise.reject(withCode("relation missing", "42P01")),
      }),
    );

    expect(response.status).toBe(500);
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
    expect(JSON.parse(text)).toEqual({ error: "figures_unavailable" });

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
      [
        "shape throws",
        () =>
          store({
            latest: async () => [
              {
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
              },
            ],
          }),
      ],
    ];

    for (const [label, readStore] of cases) {
      errorSpy.mockClear();
      const response = await failingRespond(readStore);
      expect(response.status, label).toBe(500);
      expect(loggedLines(), label).toHaveLength(1);
      expect(loggedLines()[0], label).not.toContain("\n");
    }
  });
});
