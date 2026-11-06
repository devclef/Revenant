// Feature: 08-judge-polish, Property 25: Freshness classification is fail, warn or pass by the two rules
//
// Tests for scripts/fetch-figures-freshness.mjs (spec 08-judge-polish, design.md
// "The Freshness_Check"; R21.5 to R21.15). The script lives outside src/, so this
// file sits under src/lib/sources/ where Vitest collects it. Every body here is a
// synthetic test fixture: metric ids start with FIXTURE and values are zero, so
// nothing reads as a real figure (data-integrity.md, fixture rule).

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  FIGURES_URL,
  FETCH_FAILURE_MS,
  classifyFreshness,
  main,
  planIssue,
} from "../../../scripts/fetch-figures-freshness.mjs";

const DAY = 24 * 60 * 60 * 1000;
const RUN_AT = Date.UTC(2026, 10, 5, 12, 0, 0); // 2026-11-05T12:00:00Z
const RUN_ISO = new Date(RUN_AT).toISOString();

type PeriodType = "weekly" | "monthly";

type Series = {
  metric: { id: string; display_name: string; unit: string; region: string; source: string; series_id: string };
  period_type: PeriodType;
  last_success_at: string | null;
  figure: { value: string; period: string; retrieved_at: string } | null;
  fallback?: boolean;
};

function series(overrides: Partial<Series> & { id?: string } = {}): Series {
  const { id = "FIXTURE-fuel", ...rest } = overrides;
  return {
    metric: {
      id,
      display_name: "FIXTURE metric",
      unit: "FIXTURE unit",
      region: "FIXTURE region",
      source: "FIXTURE source",
      series_id: "FIXTURE-series",
    },
    period_type: "weekly",
    last_success_at: new Date(RUN_AT - 60 * 60 * 1000).toISOString(),
    figure: { value: "0", period: "2026-11-02", retrieved_at: new Date(RUN_AT - 60 * 60 * 1000).toISOString() },
    ...rest,
  };
}

function body(list: Series[]) {
  return { format: "revenant-figures-v1", generated_at: RUN_ISO, source_mode: "db", series: list };
}

function ok(list: Series[]) {
  return { ok: true as const, body: body(list) };
}

describe("classifyFreshness", () => {
  it("passes when every series is fresh and recent", () => {
    expect(classifyFreshness(ok([series()]), RUN_AT).status).toBe("pass");
  });

  it("fails a request problem with no series findings", () => {
    const c = classifyFreshness({ kind: "request_failed", problem: "http", status: 503 } as never, RUN_AT);
    expect(c.status).toBe("fail");
    expect(c.request).toEqual({ kind: "request_failed", problem: "http", status: 503 });
    expect(c.findings).toEqual([]);
  });

  it("fails a body that is not the revenant-figures-v1 shape", () => {
    expect(classifyFreshness({ ok: true, body: { format: "other", series: [] } }, RUN_AT).status).toBe("fail");
    expect(classifyFreshness({ ok: true, body: "not json shape" }, RUN_AT).status).toBe("fail");
  });

  it("fails an empty series array", () => {
    const c = classifyFreshness(ok([]), RUN_AT);
    expect(c.status).toBe("fail");
    expect(c.request).toEqual({ kind: "request_failed", problem: "no_series" });
  });

  it("fails a series whose last_success_at is null", () => {
    const c = classifyFreshness(ok([series({ last_success_at: null })]), RUN_AT);
    expect(c.status).toBe("fail");
    expect(c.findings.some((f) => f.result === "fail" && f.metric_id === "FIXTURE-fuel")).toBe(true);
  });

  it("fails an unparsable last_success_at", () => {
    expect(classifyFreshness(ok([series({ last_success_at: "yesterday-ish" })]), RUN_AT).status).toBe("fail");
  });

  it("passes exactly 48 hours after the last success and fails one millisecond later", () => {
    const atEdge = new Date(RUN_AT - FETCH_FAILURE_MS).toISOString();
    const pastEdge = new Date(RUN_AT - FETCH_FAILURE_MS - 1).toISOString();
    expect(classifyFreshness(ok([series({ last_success_at: atEdge })]), RUN_AT).status).toBe("pass");
    expect(classifyFreshness(ok([series({ last_success_at: pastEdge })]), RUN_AT).status).toBe("fail");
  });

  it("reads a 2026-02 monthly period as 28 February 2026", () => {
    const monthly = (period: string) =>
      series({ period_type: "monthly", figure: { value: "0", period, retrieved_at: RUN_ISO } });
    // 28 Feb to 14 Mar is 14 days: not more than 14, so no warning.
    expect(classifyFreshness(ok([monthly("2026-02")]), Date.UTC(2026, 2, 14)).status).toBe("pass");
    // 28 Feb to 15 Mar is 15 days: a warning naming the period.
    const c = classifyFreshness(ok([monthly("2026-02")]), Date.UTC(2026, 2, 15));
    expect(c.status).toBe("warn");
    expect(c.findings[0].detail).toContain("2026-02");
  });

  it("warns only when a weekly period is more than 14 days before the run's UTC date", () => {
    const weekly = (period: string) => series({ figure: { value: "0", period, retrieved_at: RUN_ISO } });
    expect(classifyFreshness(ok([weekly("2026-10-23")]), RUN_AT).status).toBe("pass"); // 13 days
    expect(classifyFreshness(ok([weekly("2026-10-22")]), RUN_AT).status).toBe("pass"); // 14 days, not more than 14
    expect(classifyFreshness(ok([weekly("2026-10-21")]), RUN_AT).status).toBe("warn"); // 15 days
  });

  it("warns on a series with no stored figure", () => {
    const c = classifyFreshness(ok([series({ figure: null })]), RUN_AT);
    expect(c.status).toBe("warn");
    expect(c.findings[0].detail).toBe("no stored figure");
  });

  it("never reads retrieved_at", () => {
    const stale = series({ figure: { value: "0", period: "2026-11-02", retrieved_at: "2000-01-01T00:00:00Z" } });
    expect(classifyFreshness(ok([stale]), RUN_AT).status).toBe("pass");
  });

  it("returns fail, not warn, when a series trips both checks", () => {
    const c = classifyFreshness(ok([series({ last_success_at: null, figure: null })]), RUN_AT);
    expect(c.status).toBe("fail");
    expect(c.findings.map((f) => f.result).sort()).toEqual(["fail", "warn"]);
  });
});

describe("classifyFreshness with the optional fallback field (#248)", () => {
  const weekly = (period: string) => series({ figure: { value: "0", period, retrieved_at: RUN_ISO } });

  it("passes a fresh series with fallback true", () => {
    expect(classifyFreshness(ok([series({ fallback: true })]), RUN_AT).status).toBe("pass");
  });

  it("passes a fresh series with fallback false", () => {
    expect(classifyFreshness(ok([series({ fallback: false })]), RUN_AT).status).toBe("pass");
  });

  it("passes a fresh series with fallback absent", () => {
    expect(classifyFreshness(ok([series()]), RUN_AT).status).toBe("pass");
  });

  it("fails a series with fallback true when its last success is stale", () => {
    const old = new Date(RUN_AT - FETCH_FAILURE_MS - 1).toISOString();
    expect(classifyFreshness(ok([series({ fallback: true, last_success_at: old })]), RUN_AT).status).toBe("fail");
  });

  it("warns on a fallback true series whose period is more than 14 days old", () => {
    expect(classifyFreshness(ok([weekly("2026-10-21")].map((s) => ({ ...s, fallback: true }))), RUN_AT).status).toBe("warn");
  });

  it("classifies fallback true and fallback false identically for the same series", () => {
    const base = weekly("2026-10-21");
    const withTrue = classifyFreshness(ok([{ ...base, fallback: true }]), RUN_AT);
    const withFalse = classifyFreshness(ok([{ ...base, fallback: false }]), RUN_AT);
    expect(withTrue).toEqual(withFalse);
  });

  it("treats a non-boolean fallback as a parse failure", () => {
    const bad = { ...series(), fallback: "yes" } as unknown as Series;
    const c = classifyFreshness(ok([bad]), RUN_AT);
    expect(c.status).toBe("fail");
    expect(c.request).toEqual({ kind: "request_failed", problem: "parse" });
  });
});

function periodFor(runAt: number, periodType: PeriodType, back: number): string {
  const d = new Date(runAt);
  if (periodType === "weekly") {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - back * DAY).toISOString().slice(0, 10);
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1)).toISOString().slice(0, 7);
}

// Oracle for the period age: the period date in UTC milliseconds, measured
// against the run's UTC calendar date.
function periodAgeDays(s: Series, runAt: number): number {
  const runDay = Date.UTC(new Date(runAt).getUTCFullYear(), new Date(runAt).getUTCMonth(), new Date(runAt).getUTCDate());
  const [y, m, d] = s.figure!.period.split("-").map(Number);
  const periodMs = s.period_type === "weekly" ? Date.UTC(y, m - 1, d) : Date.UTC(y, m, 0);
  return Math.round((runDay - periodMs) / DAY);
}

// Property 25, classification half. The oracle restates the two rules directly.
describe("Property 25: classification is fail, warn or pass by the two rules", () => {
  const seriesArb = fc.record({
    lastSuccessMs: fc.option(fc.integer({ min: 0, max: 5 * DAY }), { nil: null }),
    periodType: fc.constantFrom<PeriodType>("weekly", "monthly"),
    periodBack: fc.integer({ min: 0, max: 60 }),
    hasFigure: fc.boolean(),
  });

  it("matches the oracle for any series list and run time", () => {
    fc.assert(
      fc.property(
        fc.array(seriesArb, { maxLength: 4 }),
        fc.integer({ min: Date.UTC(2026, 0, 1), max: Date.UTC(2027, 11, 31) }),
        fc.boolean(),
        (items, runAt, requestBroken) => {
          const list: Series[] = items.map((it, i) =>
            series({
              metric: { ...series().metric, id: `FIXTURE-${i}` },
              period_type: it.periodType,
              last_success_at: it.lastSuccessMs === null ? null : new Date(runAt - it.lastSuccessMs).toISOString(),
              figure: it.hasFigure
                ? { value: "0", period: periodFor(runAt, it.periodType, it.periodBack), retrieved_at: new Date(runAt).toISOString() }
                : null,
            }),
          );

          const result = requestBroken ? ({ kind: "request_failed", problem: "network" } as never) : ok(list);
          const actual = classifyFreshness(result, runAt).status;

          let expected: "fail" | "warn" | "pass";
          if (requestBroken || list.length === 0) {
            expected = "fail";
          } else if (list.some((s) => s.last_success_at === null || runAt - Date.parse(s.last_success_at) > FETCH_FAILURE_MS)) {
            expected = "fail";
          } else if (list.some((s) => s.figure === null || periodAgeDays(s, runAt) > 14)) {
            expected = "warn";
          } else {
            expected = "pass";
          }
          return actual === expected;
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("planIssue", () => {
  const warn = { status: "warn", findings: [{ metric_id: "FIXTURE-a", result: "warn", detail: "no stored figure" }] };
  const fail = { status: "fail", findings: [{ metric_id: "FIXTURE-a", result: "fail", detail: "no successful fetch on record" }] };
  const pass = { status: "pass", findings: [] };

  it("opens a failure issue when none is open", () => {
    const p = planIssue(fail as never, null, RUN_ISO);
    expect(p).toMatchObject({ action: "open", title: "Freshness check: failure", labels: ["freshness:failure"] });
    const text = (p as { body: string }).body;
    expect(text).toContain("FIXTURE-a: fail no successful fetch on record");
    expect(text).toContain(RUN_ISO);
  });

  it("opens a warning issue when none is open", () => {
    expect(planIssue(warn as never, null, RUN_ISO)).toMatchObject({
      action: "open",
      title: "Freshness check: warning",
      labels: ["freshness:warning"],
    });
  });

  it("does nothing on pass with no open issue", () => {
    expect(planIssue(pass as never, null, RUN_ISO)).toEqual({ action: "none" });
  });

  it("comments and closes on pass with an open issue", () => {
    const p = planIssue(pass as never, { number: 7, labels: [{ name: "freshness:failure" }] }, RUN_ISO);
    expect(p).toEqual({
      action: "close",
      issue: 7,
      body: `Both checks passed for every series. Run at ${RUN_ISO}.`,
    });
  });

  it("only comments when the open issue already has the matching label and title", () => {
    const p = planIssue(fail as never, { number: 3, labels: ["freshness:failure"] }, RUN_ISO);
    expect(p.action).toBe("comment");
    expect(p).not.toHaveProperty("title");
    expect(p).not.toHaveProperty("labels");
  });

  it("retitles and swaps the label when a failure lands on a warning issue", () => {
    expect(planIssue(fail as never, { number: 3, labels: ["freshness:warning"] }, RUN_ISO)).toMatchObject({
      action: "comment",
      issue: 3,
      title: "Freshness check: failure",
      labels: ["freshness:failure"],
      remove: ["freshness:warning"],
    });
  });

  it("retitles and swaps the label when a warning lands on a failure issue", () => {
    expect(planIssue(warn as never, { number: 3, labels: [{ name: "freshness:failure" }] }, RUN_ISO)).toMatchObject({
      action: "comment",
      title: "Freshness check: warning",
      labels: ["freshness:warning"],
      remove: ["freshness:failure"],
    });
  });

  it("never plans a second open issue", () => {
    for (const cls of [warn, fail]) {
      for (const open of [{ number: 1, labels: ["freshness:failure"] }, { number: 1, labels: ["freshness:warning"] }]) {
        expect(planIssue(cls as never, open, RUN_ISO).action).not.toBe("open");
      }
    }
  });
});

// Property 25, issue half. For any status and open issue, the plan opens only
// with no open issue and a non-pass status, closes only on pass, and otherwise
// comments with the title and label matching the status.
describe("Property 25: planIssue", () => {
  const statusArb = fc.constantFrom("fail", "warn", "pass");
  const openArb = fc.constantFrom<{ number: number; labels: string[] } | null>(
    null,
    { number: 4, labels: ["freshness:failure"] },
    { number: 4, labels: ["freshness:warning"] },
  );

  it("opens, comments and closes exactly as the status and open issue require", () => {
    fc.assert(
      fc.property(statusArb, openArb, (status, open) => {
        const cls = {
          status,
          findings: status === "pass" ? [] : [{ metric_id: "FIXTURE-a", result: status, detail: "d" }],
        };
        const plan = planIssue(cls as never, open as never, RUN_ISO) as Record<string, unknown>;
        if (open === null) {
          return status === "pass" ? plan.action === "none" : plan.action === "open";
        }
        if (status === "pass") return plan.action === "close" && plan.issue === 4;
        if (plan.action !== "comment") return false;
        const wanted = status === "fail" ? "freshness:failure" : "freshness:warning";
        const wantedTitle = status === "fail" ? "Freshness check: failure" : "Freshness check: warning";
        if (open.labels.includes(wanted)) return !("title" in plan);
        return plan.title === wantedTitle && (plan.labels as string[]).join() === wanted;
      }),
      { numRuns: 100 },
    );
  });
});

// main() with every network call injected. Nothing reaches the real network.
type Call = { url: string; method: string; headers: Record<string, string>; body?: unknown };

function fakeWorld(opts: { figures: Response | Error; github?: (call: Call) => Response }) {
  const calls: Call[] = [];
  const fetchImpl = async (url: string | URL | Request, init: RequestInit = {}) => {
    const target = String(url);
    const headers = (init.headers ?? {}) as Record<string, string>;
    const call: Call = {
      url: target,
      method: init.method ?? "GET",
      headers,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    if (target === FIGURES_URL) {
      if (opts.figures instanceof Error) throw opts.figures;
      return opts.figures.clone();
    }
    return (opts.github ?? (() => new Response("[]", { status: 200 })))(call);
  };
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
}

function figuresOk(list: Series[]) {
  return new Response(JSON.stringify(body(list)), { status: 200, headers: { "Content-Type": "application/json" } });
}

const env = { GITHUB_TOKEN: "test-token-not-real", GITHUB_REPOSITORY: "devclef/Revenant", FRESHNESS_ASSIGNEE: "devclef" };
const quiet = { now: () => RUN_AT, log: () => {}, errorLog: () => {} };

describe("main", () => {
  it("sends no credential to the figures origin", async () => {
    const world = fakeWorld({ figures: figuresOk([series()]) });
    await main({ fetch: world.fetchImpl, env, ...quiet });
    const figuresCall = world.calls.find((c) => c.url === FIGURES_URL);
    expect(figuresCall).toBeDefined();
    const headerNames = Object.keys(figuresCall!.headers).map((h) => h.toLowerCase());
    expect(headerNames).not.toContain("authorization");
    expect(headerNames).not.toContain("cookie");
    expect(JSON.stringify(figuresCall!.headers)).not.toContain("test-token-not-real");
  });

  it("exits 0 on pass and sends the GitHub token only to api.github.com", async () => {
    const world = fakeWorld({ figures: figuresOk([series()]) });
    expect(await main({ fetch: world.fetchImpl, env, ...quiet })).toBe(0);
    const gh = world.calls.filter((c) => c.url !== FIGURES_URL);
    expect(gh.every((c) => c.url.startsWith("https://api.github.com/"))).toBe(true);
    expect(gh.every((c) => c.headers.Authorization === "Bearer test-token-not-real")).toBe(true);
  });

  it("opens an assigned failure issue and exits 1 when the request fails", async () => {
    const world = fakeWorld({
      figures: new Response("down", { status: 503 }),
      github: (call) =>
        call.method === "POST" && call.url.endsWith("/issues")
          ? new Response("{}", { status: 201 })
          : new Response("[]", { status: 200 }),
    });
    expect(await main({ fetch: world.fetchImpl, env, ...quiet })).toBe(1);
    const created = world.calls.find((c) => c.method === "POST" && c.url.endsWith("/issues"));
    expect(created?.body).toMatchObject({
      title: "Freshness check: failure",
      labels: ["freshness:failure"],
      assignees: ["devclef"],
    });
  });

  it("creates the two labels and ignores a 422 already-exists", async () => {
    const world = fakeWorld({
      figures: figuresOk([series()]),
      github: (call) =>
        call.url.endsWith("/labels") ? new Response("{}", { status: 422 }) : new Response("[]", { status: 200 }),
    });
    expect(await main({ fetch: world.fetchImpl, env, ...quiet })).toBe(0);
    expect(world.calls.filter((c) => c.url.endsWith("/labels")).length).toBe(2);
  });

  it("exits 1 on a GitHub API error and prints only the status", async () => {
    const lines: string[] = [];
    const world = fakeWorld({
      figures: figuresOk([series()]),
      github: () => new Response("secret body that must not print", { status: 500 }),
    });
    const code = await main({
      fetch: world.fetchImpl,
      env,
      now: () => RUN_AT,
      log: () => {},
      errorLog: (s: string) => lines.push(s),
    });
    expect(code).toBe(1);
    const printed = lines.join("\n");
    expect(printed).toContain("HTTP 500");
    expect(printed).not.toContain("secret body");
    expect(printed).not.toContain("test-token-not-real");
  });

  it("exits 0 on warn", async () => {
    const world = fakeWorld({ figures: figuresOk([series({ figure: null })]) });
    expect(await main({ fetch: world.fetchImpl, env, ...quiet })).toBe(0);
  });
});
