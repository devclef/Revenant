// Tests for GET /api/figures in file mode (spec 08-judge-polish, Property 23
// file-mode part, and the example cases in tasks.md task 14), plus the Sweden
// and SEK guard for the file-mode body (R23.1).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";

import { CATALOGUE } from "@/lib/figures/catalogue";
import { DEMO_FIGURES } from "@/lib/figures/demo";
import { parseFiguresResponse, type FiguresResponseV1 } from "@/lib/figures/now";
import realFile from "@/lib/figures/real/fuel-figures.json";
import { loadFigureFile } from "@/lib/figures/load";
import type { FigureV1 } from "@/lib/seal-format";

import {
  buildFiguresResponse,
  figuresSourceMode,
} from "./build-response";
import { GET } from "./route";

const CACHE_CONTROL = "public, max-age=600, stale-while-revalidate=3600";
const STATUS_TIME = "2026-11-05T06:30:00Z";

async function getBody(): Promise<FiguresResponseV1> {
  const response = await GET();
  expect(response.status).toBe(200);
  const parsed = parseFiguresResponse(await response.json());
  if (!parsed.ok) throw new Error("body rejected by parseFiguresResponse");
  return parsed.value;
}

// Oracle for "latest figure": the raw committed rows for one metric, greatest
// period, then newest retrieved_at. Built from fuel-figures.json directly, not
// from DEMO_FIGURES, so the route is checked against independent input.
const rawRows = (realFile as { figures: FigureV1[] }).figures;

function oracleLatest(metricId: string): FigureV1 | null {
  let best: FigureV1 | null = null;
  for (const row of rawRows) {
    if (row.metric_id !== metricId) continue;
    if (best === null) {
      best = row;
      continue;
    }
    if (row.period > best.period) best = row;
    else if (
      row.period === best.period &&
      row.kind === "official" &&
      best.kind === "official" &&
      row.retrieved_at > best.retrieved_at
    ) {
      best = row;
    }
  }
  return best;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

// The file-mode tests below pin FIGURES_SOURCE=file. The default is db, which
// reads Postgres; db mode has its own tests in db-response.test.ts.
beforeEach(() => {
  vi.stubEnv("FIGURES_SOURCE", "file");
});

describe("GET /api/figures (file mode)", () => {
  it("answers 200 with the Cache-Control header", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(CACHE_CONTROL);
  });

  it("lists exactly one entry per Catalogue series, in Catalogue order", async () => {
    const body = await getBody();

    expect(body.series.map((s) => s.metric.id)).toEqual(
      CATALOGUE.map((c) => c.metric.id),
    );
    expect(body.series).toHaveLength(CATALOGUE.length);
    for (const entry of body.series) {
      const cat = CATALOGUE.find((c) => c.metric.id === entry.metric.id);
      expect(entry.metric).toEqual(cat?.metric);
      expect(entry.period_type).toBe(cat?.period_type);
    }
  });

  it("ignores ?metric= and any other query parameter", async () => {
    // GET takes no request, so it cannot read a query string. A ?metric=
    // request therefore gets the full list, the same as a bare request.
    const plain = await getBody();
    const again = await getBody();

    const strip = (b: FiguresResponseV1) => ({ ...b, generated_at: "" });
    expect(strip(again)).toEqual(strip(plain));
    expect(plain.series).toHaveLength(CATALOGUE.length);
    expect(GET.length).toBe(0);
  });

  it("gives last_success_at null for every series while fetch-status.json is empty", async () => {
    const body = await getBody();

    for (const entry of body.series) {
      expect(entry.last_success_at, entry.metric.id).toBeNull();
    }
  });

  it("gives the latest-period figure with its full provenance for each series", async () => {
    const body = await getBody();

    for (const entry of body.series) {
      const expected = oracleLatest(entry.metric.id);
      expect(entry.figure, entry.metric.id).toEqual(expected);
      expect(entry.figure).not.toBeNull();
    }
  });

  it("body passes parseFiguresResponse and is US and EU only", async () => {
    const body = await getBody();
    const regions = new Set(body.series.map((s) => s.metric.region));

    expect(regions).toEqual(new Set(["U.S.", "EU27, weighted average"]));
  });
});

describe("Sweden and SEK guard on the file-mode body (R23.1)", () => {
  it("contains no Sweden region and no SEK unit anywhere in the body", async () => {
    const text = JSON.stringify(
      await (await GET()).json(),
    );

    expect(text).not.toMatch(/sweden/i);
    expect(text).not.toMatch(/\bSEK\b/);
  });
});

describe("Property 23 (file-mode part): the Figures_API lists every series with its latest figure", () => {
  const metricIds = CATALOGUE.map((c) => c.metric.id);

  it("holds for any fetch-status subset", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.subarray(metricIds),
        async (withStatus) => {
          const status = Object.fromEntries(
            withStatus.map((id) => [id, STATUS_TIME]),
          );
          const body = buildFiguresResponse({
            loaded: loadFigureFile(realFile, CATALOGUE),
            catalogue: CATALOGUE,
            fetchStatus: status,
            sourceMode: "file",
            generatedAt: "2026-11-05T15:00:00Z",
          });
          const viaRoute = await getBody();

          // Order and count follow the Catalogue.
          expect(body.series.map((s) => s.metric.id)).toEqual(metricIds);
          for (const entry of body.series) {
            expect(entry.figure).toEqual(oracleLatest(entry.metric.id));
            expect(entry.last_success_at).toBe(
              withStatus.includes(entry.metric.id) ? STATUS_TIME : null,
            );
          }
          // The route serves the bundled status file, and it has no query input.
          expect(viaRoute.series).toEqual(
            buildFiguresResponse({
              loaded: DEMO_FIGURES,
              catalogue: CATALOGUE,
              fetchStatus: {},
              sourceMode: "file",
              generatedAt: "",
            }).series,
          );
        },
      ),
      { numRuns: 60 },
    );
  });
});

describe("buildFiguresResponse rules", () => {
  it("gives last_success_at null for a series missing from fetch-status.json", () => {
    const body = buildFiguresResponse({
      loaded: DEMO_FIGURES,
      catalogue: CATALOGUE,
      fetchStatus: { "us-diesel": STATUS_TIME },
      sourceMode: "file",
      generatedAt: "2026-11-05T15:00:00Z",
    });

    const byId = new Map(body.series.map((s) => [s.metric.id, s]));
    expect(byId.get("us-diesel")?.last_success_at).toBe(STATUS_TIME);
    expect(byId.get("us-gasoline-regular")?.last_success_at).toBeNull();
    expect(byId.get("eu-diesel")?.last_success_at).toBeNull();
  });

  it("gives null last_success_at for every series when the status file is missing", () => {
    const body = buildFiguresResponse({
      loaded: DEMO_FIGURES,
      catalogue: CATALOGUE,
      fetchStatus: null,
      sourceMode: "file",
      generatedAt: "2026-11-05T15:00:00Z",
    });

    for (const entry of body.series) {
      expect(entry.last_success_at, entry.metric.id).toBeNull();
      // The figures are still there: a missing status never hides a figure.
      expect(entry.figure).not.toBeNull();
    }
  });

  it("never uses the newest retrieved_at as last_success_at", () => {
    const body = buildFiguresResponse({
      loaded: DEMO_FIGURES,
      catalogue: CATALOGUE,
      fetchStatus: {},
      sourceMode: "file",
      generatedAt: "2026-11-05T15:00:00Z",
    });

    for (const entry of body.series) {
      expect(entry.figure).not.toBeNull();
      expect(entry.last_success_at).toBeNull();
    }
  });

  it("gives a null figure for a series with no stored rows", () => {
    const empty = loadFigureFile(
      { fixture: false, series: [], figures: [] },
      CATALOGUE,
    );
    const body = buildFiguresResponse({
      loaded: empty,
      catalogue: CATALOGUE,
      fetchStatus: {},
      sourceMode: "file",
      generatedAt: "2026-11-05T15:00:00Z",
    });

    expect(body.series).toHaveLength(CATALOGUE.length);
    for (const entry of body.series) {
      expect(entry.figure).toBeNull();
    }
  });

  it("reports the source mode it was given", () => {
    const body = buildFiguresResponse({
      loaded: DEMO_FIGURES,
      catalogue: CATALOGUE,
      fetchStatus: {},
      sourceMode: "db",
      generatedAt: "2026-11-05T15:00:00Z",
    });

    expect(body.source_mode).toBe("db");
  });
});

describe("figuresSourceMode (FIGURES_SOURCE)", () => {
  it("selects file mode only for the exact value file", () => {
    expect(figuresSourceMode("file")).toBe("file");
    expect(figuresSourceMode("db")).toBe("db");
    expect(figuresSourceMode(undefined)).toBe("db");
    expect(figuresSourceMode("")).toBe("db");
    expect(figuresSourceMode("FILE")).toBe("db");
  });

  it("the route reports source_mode from FIGURES_SOURCE", async () => {
    vi.stubEnv("FIGURES_SOURCE", "file");
    expect((await getBody()).source_mode).toBe("file");
  });

  it("with FIGURES_SOURCE unset the route reads the database, and answers the fallback with 200 with no DATABASE_URL", async () => {
    vi.stubEnv("FIGURES_SOURCE", "");
    vi.stubEnv("DATABASE_URL", "");

    const response = await GET();
    const text = await response.text();

    // X3: no DATABASE_URL is a failed read, so the route answers the bundled fallback (200).
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(JSON.parse(text).series.length).toBeGreaterThan(0);
    expect(text).not.toMatch(/postgres/i);
  });
});
