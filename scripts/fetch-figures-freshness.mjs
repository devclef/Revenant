// The Freshness_Check (spec 08-judge-polish, design.md "The Freshness_Check";
// R21.5 to R21.15). A scheduled GitHub Actions job runs this script every six
// hours. It reads the public GET /api/figures, classifies the result as fail,
// warn or pass, and keeps one Freshness_Issue in step with that status.
//
// Plain ESM on Node 22 built-ins only, so the workflow needs no npm ci. The
// two pure functions are exported for Vitest. main() runs only when this file
// is the entry point. It takes its dependencies as arguments so the tests can
// run it with no network.
//
// Security: the figures request sends no credential. GITHUB_TOKEN is used only
// for api.github.com. Error output names an HTTP status, never a token or a
// response body.

import { pathToFileURL } from "node:url";

export const FIGURES_URL = "https://revenant.devclef.se/api/figures";
export const FETCH_TIMEOUT_MS = 30_000;
export const FETCH_FAILURE_HOURS = 48;
export const FETCH_FAILURE_MS = FETCH_FAILURE_HOURS * 60 * 60 * 1000; // 172,800,000
export const PERIOD_AGE_WARN_DAYS = 14;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const LABEL_FAILURE = "freshness:failure";
export const LABEL_WARNING = "freshness:warning";
export const TITLE_FAILURE = "Freshness check: failure";
export const TITLE_WARNING = "Freshness check: warning";

const FORMAT = "revenant-figures-v1";

/**
 * Turns a figure period into the date it names, in UTC milliseconds.
 * A weekly period (YYYY-MM-DD) names that date. A monthly period (YYYY-MM)
 * names the last day of the month. Returns null if the text does not fit the
 * period type, or the date does not exist (for example 2026-02-30).
 * @param {string} period
 * @param {"weekly" | "monthly"} periodType
 * @returns {number | null}
 */
function periodDateMs(period, periodType) {
  if (typeof period !== "string") return null;
  if (periodType === "weekly") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(period);
    if (!m) return null;
    return utcDateMs(Number(m[1]), Number(m[2]), Number(m[3]));
  }
  if (periodType === "monthly") {
    const m = /^(\d{4})-(\d{2})$/.exec(period);
    if (!m) return null;
    // Day 0 of the next month is the last day of the named month.
    return lastDayOfMonthMs(Number(m[1]), Number(m[2]));
  }
  return null;
}

/**
 * UTC midnight for a calendar date. Returns null if the date does not exist,
 * such as 2026-02-30, which would otherwise roll over into March.
 * @returns {number | null}
 */
function utcDateMs(year, month, day) {
  if (month < 1 || month > 12 || day < 1) return null;
  const ms = Date.UTC(year, month - 1, day);
  const d = new Date(ms);
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return ms;
}

/** UTC midnight of the last day of a month (month is 1 to 12). */
function lastDayOfMonthMs(year, month) {
  if (month < 1 || month > 12) return null;
  return Date.UTC(year, month, 0);
}

/** UTC calendar date of a run, as midnight UTC milliseconds. */
function utcDayOf(runAtMs) {
  const d = new Date(runAtMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Checks the revenant-figures-v1 shape. Returns the series array, or null. */
function parseBody(body) {
  if (!body || typeof body !== "object") return null;
  if (body.format !== FORMAT) return null;
  if (!Array.isArray(body.series)) return null;
  for (const entry of body.series) {
    if (!entry || typeof entry !== "object") return null;
    if (!entry.metric || typeof entry.metric !== "object") return null;
    if (typeof entry.metric.id !== "string" || entry.metric.id === "") return null;
    if (entry.period_type !== "weekly" && entry.period_type !== "monthly") return null;
    if (!("last_success_at" in entry)) return null;
    if (entry.last_success_at !== null && typeof entry.last_success_at !== "string") return null;
    if (!("figure" in entry)) return null;
    if (entry.figure !== null && typeof entry.figure !== "object") return null;
    // `fallback` is optional (#248). When present it must be a boolean. It does
    // not change how a series is classified.
    if ("fallback" in entry && typeof entry.fallback !== "boolean") return null;
  }
  return body.series;
}

/**
 * Classifies one Figures_API result. Pure: no network, no clock, no I/O.
 * It reads last_success_at and the figure period, and never retrieved_at.
 *
 * @param {{ ok: true, body: unknown } | { kind: "request_failed", problem: "network" | "timeout" | "http" | "parse" | "no_series", status?: number }} result
 * @param {number} runAtMs run time, epoch milliseconds
 * @returns {{ status: "fail" | "warn" | "pass", request?: object, findings: Array<{ metric_id: string, result: "fail" | "warn", detail: string }> }}
 */
export function classifyFreshness(result, runAtMs) {
  if (!result || result.ok !== true) {
    const problem = result && result.kind === "request_failed" ? result : { kind: "request_failed", problem: "parse" };
    const request = { kind: "request_failed", problem: problem.problem };
    if (problem.status !== undefined) request.status = problem.status;
    return { status: "fail", request, findings: [] };
  }

  const series = parseBody(result.body);
  if (series === null) {
    return { status: "fail", request: { kind: "request_failed", problem: "parse" }, findings: [] };
  }
  if (series.length === 0) {
    return { status: "fail", request: { kind: "request_failed", problem: "no_series" }, findings: [] };
  }

  const findings = [];
  const runDay = utcDayOf(runAtMs);

  for (const entry of series) {
    const id = entry.metric.id;

    // Fetch_Failure_Check (R21.7): last_success_at must be parsable and at most 48 h old.
    if (entry.last_success_at === null) {
      findings.push({ metric_id: id, result: "fail", detail: "no successful fetch on record" });
    } else {
      const successMs = Date.parse(entry.last_success_at);
      if (Number.isNaN(successMs)) {
        findings.push({ metric_id: id, result: "fail", detail: "last successful fetch time is unreadable" });
      } else if (runAtMs - successMs > FETCH_FAILURE_MS) {
        findings.push({ metric_id: id, result: "fail", detail: `last successful fetch was more than ${FETCH_FAILURE_HOURS} hours before this check` });
      }
    }

    // Period_Age_Warning (R21.8): the figure's period date must be at most 14 days old.
    if (entry.figure === null) {
      findings.push({ metric_id: id, result: "warn", detail: "no stored figure" });
    } else {
      const dateMs = periodDateMs(entry.figure.period, entry.period_type);
      if (dateMs === null) {
        findings.push({ metric_id: id, result: "warn", detail: "period is not readable" });
      } else {
        const ageDays = Math.round((runDay - dateMs) / DAY_MS);
        if (ageDays > PERIOD_AGE_WARN_DAYS) {
          findings.push({ metric_id: id, result: "warn", detail: `latest period ${entry.figure.period} is more than ${PERIOD_AGE_WARN_DAYS} days old` });
        }
      }
    }
  }

  let status = "pass";
  if (findings.some((f) => f.result === "fail")) status = "fail";
  else if (findings.some((f) => f.result === "warn")) status = "warn";
  return { status, findings };
}

/** Normalises issue labels (GitHub objects or plain strings) to names. */
function labelNames(labels) {
  return (labels || []).map((l) => (typeof l === "string" ? l : l.name));
}

/** The lines shared by the issue body and comments. */
function findingLines(classification) {
  const lines = [];
  if (classification.request) {
    const r = classification.request;
    const status = r.status !== undefined ? ` (HTTP ${r.status})` : "";
    lines.push(`- request: ${r.problem}${status}`);
  }
  for (const f of classification.findings) {
    lines.push(`- ${f.metric_id}: ${f.result} ${f.detail}`);
  }
  return lines;
}

/**
 * Decides what to do with the one Freshness_Issue. Pure.
 *
 * @param {ReturnType<typeof classifyFreshness>} classification
 * @param {{ number: number, labels: Array<string | { name: string }>, title?: string } | null} openIssue
 * @param {string} runAtIso run time, UTC ISO text
 * @returns {{ action: "none" } | { action: "open", title: string, labels: string[], body: string } | { action: "comment", issue: number, body: string, title?: string, labels?: string[], remove?: string[] } | { action: "close", issue: number, body: string }}
 */
export function planIssue(classification, openIssue, runAtIso) {
  const status = classification.status;

  if (status === "pass") {
    if (!openIssue) return { action: "none" };
    return {
      action: "close",
      issue: openIssue.number,
      body: `Both checks passed for every series. Run at ${runAtIso}.`,
    };
  }

  const target = status === "fail"
    ? { title: TITLE_FAILURE, label: LABEL_FAILURE, other: LABEL_WARNING }
    : { title: TITLE_WARNING, label: LABEL_WARNING, other: LABEL_FAILURE };

  const heading = status === "fail" ? "Freshness check failed" : "Freshness check warning";
  const body = [
    `${heading}. Run at ${runAtIso}.`,
    "",
    ...findingLines(classification),
  ].join("\n");

  if (!openIssue) {
    return { action: "open", title: target.title, labels: [target.label], body };
  }

  const names = labelNames(openIssue.labels);
  const needsRetitle = !names.includes(target.label) || names.includes(target.other);
  const plan = { action: "comment", issue: openIssue.number, body };
  if (needsRetitle) {
    plan.title = target.title;
    plan.labels = [target.label];
    plan.remove = names.includes(target.other) ? [target.other] : [];
  }
  return plan;
}

/**
 * Requests the Figures_API once. No credential is sent.
 * @param {typeof fetch} fetchImpl
 * @returns {Promise<{ ok: true, body: unknown } | { kind: "request_failed", problem: string, status?: number }>}
 */
export async function requestFigures(fetchImpl) {
  let res;
  try {
    res = await fetchImpl(FIGURES_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "error",
    });
  } catch (err) {
    const name = err && err.name;
    const problem = name === "TimeoutError" || name === "AbortError" ? "timeout" : "network";
    return { kind: "request_failed", problem };
  }
  if (!res.ok) {
    return { kind: "request_failed", problem: "http", status: res.status };
  }
  let body;
  try {
    body = await res.json();
  } catch {
    return { kind: "request_failed", problem: "parse" };
  }
  return { ok: true, body };
}

/**
 * Runs the whole check. Returns the exit code: 1 on fail or a GitHub API
 * error, otherwise 0.
 *
 * @param {{ fetch?: typeof fetch, env?: Record<string, string | undefined>, now?: () => number, log?: (s: string) => void, errorLog?: (s: string) => void }} [deps]
 * @returns {Promise<0 | 1>}
 */
export async function main(deps = {}) {
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  const env = deps.env ?? process.env;
  const now = deps.now ?? (() => Date.now());
  const log = deps.log ?? ((s) => console.log(s));
  const errorLog = deps.errorLog ?? ((s) => console.error(s));

  const runAtMs = now();
  const runAtIso = new Date(runAtMs).toISOString();
  const classification = classifyFreshness(await requestFigures(fetchImpl), runAtMs);

  log(`freshness-check ${classification.status} at ${runAtIso}`);
  for (const line of findingLines(classification)) log(line);

  const token = env.GITHUB_TOKEN;
  const repo = env.GITHUB_REPOSITORY;
  const assignee = env.FRESHNESS_ASSIGNEE;
  if (!token || !repo) {
    errorLog("freshness check: GITHUB_TOKEN and GITHUB_REPOSITORY must be set");
    return 1;
  }

  const gh = (method, path, payload) =>
    fetchImpl(`https://api.github.com/repos/${repo}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(payload === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });

  try {
    return await manageIssue({ gh, classification, runAtIso, assignee, log });
  } catch (err) {
    // Only the HTTP status is printed, never a response body or the token.
    const detail = err && err.status ? `HTTP ${err.status}` : "network error";
    errorLog(`freshness check: GitHub API error (${detail})`);
    return 1;
  }
}

/** Creates missing labels, finds the open issue, and applies the plan. */
async function manageIssue({ gh, classification, runAtIso, assignee, log }) {
  for (const [name, color, description] of [
    [LABEL_FAILURE, "b60205", "Figures_API freshness check failed"],
    [LABEL_WARNING, "fbca04", "Figures_API freshness check warning"],
  ]) {
    const res = await gh("POST", "/labels", { name, color, description });
    if (!res.ok && res.status !== 422) throw httpError(res.status);
  }

  const open = await findOpenIssue(gh);
  const plan = planIssue(classification, open, runAtIso);
  log(`freshness-check action: ${plan.action}`);

  if (plan.action === "open") {
    const payload = { title: plan.title, body: plan.body, labels: plan.labels };
    if (assignee) payload.assignees = [assignee];
    await ensureOk(await gh("POST", "/issues", payload));
  } else if (plan.action === "comment") {
    await ensureOk(await gh("POST", `/issues/${plan.issue}/comments`, { body: plan.body }));
    if (plan.title !== undefined) {
      await ensureOk(await gh("PATCH", `/issues/${plan.issue}`, { title: plan.title }));
    }
    if (plan.labels) {
      await ensureOk(await gh("POST", `/issues/${plan.issue}/labels`, { labels: plan.labels }));
    }
    for (const name of plan.remove || []) {
      const res = await gh("DELETE", `/issues/${plan.issue}/labels/${encodeURIComponent(name)}`);
      if (!res.ok && res.status !== 404) throw httpError(res.status);
    }
  } else if (plan.action === "close") {
    await ensureOk(await gh("POST", `/issues/${plan.issue}/comments`, { body: plan.body }));
    await ensureOk(await gh("PATCH", `/issues/${plan.issue}`, { state: "closed" }));
  }

  return classification.status === "fail" ? 1 : 0;
}

/** Returns the open Freshness_Issue with the lowest number, or null. */
async function findOpenIssue(gh) {
  const found = [];
  for (const label of [LABEL_FAILURE, LABEL_WARNING]) {
    const res = await gh("GET", `/issues?state=open&labels=${encodeURIComponent(label)}&per_page=100`);
    await ensureOk(res);
    const items = await res.json();
    for (const item of items) {
      if (item.pull_request) continue;
      found.push({ number: item.number, labels: item.labels, title: item.title });
    }
  }
  if (found.length === 0) return null;
  found.sort((a, b) => a.number - b.number);
  return found[0];
}

function httpError(status) {
  const err = new Error("github");
  err.status = status;
  return err;
}

async function ensureOk(res) {
  if (!res.ok) throw httpError(res.status);
  return res;
}

// Run only when this file is the entry point, so importing it in tests does
// not trigger a request.
const isEntry = (() => {
  try {
    return process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
})();

if (isEntry) {
  main().then((code) => {
    process.exitCode = code;
  });
}
