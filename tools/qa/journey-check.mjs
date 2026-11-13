#!/usr/bin/env node
// Revenant Journey_Check (spec 09-demo-polish, design.md "A6. The Journey_Check"
// and "Owner patches", n; requirements A6). Owner-only: tools/** is not an
// agent path.
//
// A scheduled GitHub Actions job runs this script against production every six
// hours. It opens the judge's pages in headless Chromium and fails the run when
// any of these is false:
//   J1 figures-api      every series in /api/figures has a non-null figure.
//   J2 persona-reveal   us-maya and eu-tomas reach close, and every
//                       [data-figure-entry] has a now value and a retrieved
//                       date. Runs on the 00:47 UTC run and on manual runs only
//                       (OD8), because each walk stores one encrypted
//                       Recall_Record of "no answer" in the openings table.
//   J3 live-picker      /demo/live offers at least one enabled figure checkbox.
//   J4 assets           /icon.svg and /opengraph-image answer HTTP 200.
//   J5 scroll-width     /, /demo, /demo/live, /how-it-is-sealed and the first
//                       Stage of both persona pages: no sideways scroll at the
//                       five Evidence_Sizes.
//   J6 phone            PH1 to PH7 at 390x844 and 360x640 on /, both persona
//                       pages and /demo/live (runPhoneChecks from
//                       layout-check.mjs). In a J2 run the persona Stages are
//                       reached with buttons only, in the same walk as J2.
//   J7 retired-phrases  no Retired_Phrase in the rendered HTML of any page opened.
//   J8 fonts            FONT1 on every page opened (runFontCheck): the sans face
//                       everywhere, the serif face where the Letter_Text shows.
// A phone or font check whose element isn't on production yet prints a note,
// not a FAIL (A6.2 item 6).
//
// Then it keeps one Journey_Issue (label journey:failure, assigned to devclef)
// in step: a failing run opens it or comments on it; a passing run with it open
// comments and closes it.
//
// Network: requests go only to --url and api.github.com (A6.5). The browser
// aborts any request to another origin. GITHUB_TOKEN is used only for
// api.github.com; no app secret is read (A6.4). Output never prints the token.
//
// Line format: <PASS|FAIL|note> <id> <page-or-size> <measured> threshold=<...>
//
// Usage:
//   node tools/qa/journey-check.mjs --url https://revenant.devclef.se \
//     --chromium /usr/bin/google-chrome --require J1,J2,J3,J4,J5,J6,J7,J8
// Options:
//   --url <origin>      Required. Production origin.
//   --chromium <path>   Browser binary. Default $CHROMIUM_PATH, then /usr/bin/chromium.
//   --require <ids>     Checks to run. Default all of J1 to J8.
//   --reveal            Run J2 whatever the hour (the workflow sets it on manual runs
//                       through GITHUB_EVENT_NAME=workflow_dispatch).
//   --no-issue          Print results only; do not touch GitHub.
// Exit: 0 every check passed, 1 a check failed or the GitHub step failed,
// 2 the check could not start.

import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { runFontCheck, runPhoneChecks } from "./layout-check.mjs";

export const ALL_CHECKS = ["J1", "J2", "J3", "J4", "J5", "J6", "J7", "J8"];
export const EVIDENCE_SIZES = ["2560x1440", "1366x800", "1280x800", "390x844", "360x640"];
export const PHONE_SIZES = ["390x844", "360x640"];
export const REVEAL_SIZE = "390x844";
export const REVEAL_UTC_HOUR = 0;
export const LABEL = "journey:failure";
export const TITLE = "Journey check: failure";
export const ASSIGNEE = "devclef";
export const PERSONAS = ["us-maya", "eu-tomas"];
const PAGE_TIMEOUT_MS = 30_000;
const STAGE_TIMEOUT_MS = 20_000;

// The same patterns as src/test/retired-phrases.test.ts (spec 09 task 9, F8). Spec 10
// Retired_Phrases join this list in the task that removes them (spec 10 design
// "Owner patches", ac-4, ac-5, ac-10), as they join RETIRED_PHRASES in
// tools/hooks/tone-check.mjs; that list is empty until spec 10 task 4.
export const RETIRED_PHRASES = [
  { name: "the retired tagline", pattern: /your past self returns with the receipts/i },
  { name: "\"rose-tinted\"", pattern: /rose[- ]tinted/i },
  {
    name: "a time capsule named as what Revenant resurrects or revives",
    pattern: /\b(resurrect\w*|revive\w*|brings?\s+back|bring\w*\s+back)\b[^.!?]{0,60}\btime[- ]capsules?\b/i,
  },
  {
    name: "a time capsule that is resurrected, revived or brought back",
    pattern: /time[- ]capsule[^.!?]{0,40}\b(is|was)\s+(resurrected|revived|brought back)/i,
  },
];

const NEXT_QUESTION = "Next question";
const RECORD = "Record my answers";
const NO_ANSWER = "No answer";
const BREAK_SEAL = "Break the seal";
const FIGURES_HOOK = '[data-advance="figures"]';
const FIGURES_LABEL = /^(See the numbers|See the receipts)$/;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const parseSize = (size) => size.split("x").map(Number);

/** One check result. status: "pass" | "fail" | "note". */
function res(id, where, status, measured, threshold) {
  return { id, where, status, measured, threshold };
}

export function formatLine(r) {
  const head = r.status === "pass" ? "PASS" : r.status === "fail" ? "FAIL" : "note";
  return `${head} ${r.id} ${r.where} ${r.measured} threshold=${r.threshold}`;
}

/** Whether this run includes J2 (OD8): manual runs, --reveal, or the 00:xx UTC run. */
export function revealRun(eventName, startedAtMs, forced = false) {
  if (forced) return true;
  if (eventName === "workflow_dispatch") return true;
  return new Date(startedAtMs).getUTCHours() === REVEAL_UTC_HOUR;
}

/** Retired phrases in a page's rendered HTML, as text with the tags removed. */
export function retiredHits(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
  return RETIRED_PHRASES.filter(({ pattern }) => pattern.test(text)).map(({ name }) => name);
}

/**
 * Decides what to do with the one Journey_Issue. Pure.
 * @returns {{action:"none"}|{action:"open",title,labels,assignees,body}|{action:"comment",issue,body}|{action:"close",issue,body}}
 */
export function planJourneyIssue(results, openIssue, runAtIso) {
  const failed = results.filter((r) => r.status === "fail");
  if (failed.length === 0) {
    if (!openIssue) return { action: "none" };
    return { action: "close", issue: openIssue.number, body: `All checks passed. Run at ${runAtIso}.` };
  }
  const body = [
    `Journey check failed. Run at ${runAtIso}.`,
    "",
    ...failed.map((r) => `- ${r.id}: ${r.where} ${r.measured} threshold=${r.threshold}`),
  ].join("\n");
  if (!openIssue) return { action: "open", title: TITLE, labels: [LABEL], assignees: [ASSIGNEE], body };
  return { action: "comment", issue: openIssue.number, body };
}

function parseArgs(argv) {
  const opts = { url: null, chromium: null, require: [...ALL_CHECKS], reveal: false, issue: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const take = () => {
      const v = argv[i + 1];
      if (v === undefined) throw new Error(`${arg} needs a value`);
      i += 1;
      return v;
    };
    if (arg === "--url") opts.url = take().replace(/\/+$/, "");
    else if (arg === "--chromium") opts.chromium = take();
    else if (arg === "--require") opts.require = take().split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
    else if (arg === "--reveal") opts.reveal = true;
    else if (arg === "--no-issue") opts.issue = false;
    else throw new Error(`unknown option ${arg}`);
  }
  if (!opts.url) throw new Error("--url is required");
  return opts;
}

/** A page whose requests to any origin but `origin` are aborted (A6.5). */
async function newPage(browser, origin, size) {
  const [width, height] = parseSize(size);
  const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 600, hasTouch: width < 600 });
  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith("data:") || url.startsWith("blob:") || new URL(url).origin === origin) return route.continue();
    return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(PAGE_TIMEOUT_MS);
  return { context, page };
}

const stageOf = (page) =>
  page.evaluate(() => document.querySelector("[data-ceremony]")?.getAttribute("data-ceremony") ?? null);

async function waitForStage(page, names, timeout = STAGE_TIMEOUT_MS) {
  const list = Array.isArray(names) ? names : [names];
  try {
    await page.waitForFunction(
      (n) => n.includes(document.querySelector("[data-ceremony]")?.getAttribute("data-ceremony")),
      list,
      { timeout },
    );
    return true;
  } catch {
    return false;
  }
}

/** Per-page checks every opened page gets: J7, J8, and J6 at the Phone_Sizes. */
async function pageChecks(page, ctx, where, route, size) {
  if (ctx.wants("J7")) {
    // Text a reader typed (spec 10 S2.2, design "Owner patches" ac) is never checked.
    const html = await page.evaluate(() => {
      const root = document.documentElement.cloneNode(true);
      for (const el of root.querySelectorAll("[data-user-content]")) el.remove();
      return root.outerHTML;
    });
    const hits = retiredHits(html);
    ctx.add(res("J7", where, hits.length ? "fail" : "pass", `hits=${hits.length ? hits.join("; ") : "none"}`, "0"));
  }
  if (ctx.wants("J8")) {
    await page.evaluate(() => document.fonts.ready);
    const r = await runFontCheck(page);
    ctx.add(res("J8", where, r.status === "missing" ? "note" : r.status, r.detail.replace(/ threshold=.*$/, ""), "loaded and first"));
  }
  if (ctx.wants("J6") && size && PHONE_SIZES.includes(size)) {
    for (const r of await runPhoneChecks(page, size, route)) {
      const threshold = (/threshold=(.*)$/.exec(r.detail) ?? [])[1] ?? "-";
      ctx.add(res("J6", `${where} ${r.id}`, r.status === "missing" ? "note" : r.status, r.detail.replace(/ threshold=.*$/, ""), threshold));
    }
  }
}

async function scrollWidth(page) {
  return page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
}

/**
 * The persona page's First_Step (spec 10 C1): the page opens straight on
 * Testify, so the first Stage is `recall`, with the Testify_Context above the
 * first question. There is no pick-up Stage and no "Pick up the letter" button.
 */
async function waitForFirstStage(page) {
  return waitForStage(page, "recall");
}

async function checkJ1(ctx) {
  let body;
  try {
    const r = await fetch(`${ctx.origin}/api/figures`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(PAGE_TIMEOUT_MS), redirect: "error" });
    if (!r.ok) return ctx.add(res("J1", "/api/figures", "fail", `HTTP ${r.status}`, "200 and every figure non-null"));
    body = await r.json();
  } catch (error) {
    return ctx.add(res("J1", "/api/figures", "fail", `request failed (${error?.name ?? "error"})`, "200 and every figure non-null"));
  }
  const series = Array.isArray(body?.series) ? body.series : [];
  const empty = series.filter((s) => s?.figure === null || s?.figure === undefined).map((s) => s?.metric?.id ?? "?");
  ctx.add(res("J1", "/api/figures", series.length && !empty.length ? "pass" : "fail", `series=${series.length} null=${empty.length ? empty.join(",") : "none"}`, "every figure non-null"));
}

async function checkJ4(ctx) {
  for (const path of ["/icon.svg", "/opengraph-image"]) {
    try {
      const r = await fetch(`${ctx.origin}${path}`, { signal: AbortSignal.timeout(PAGE_TIMEOUT_MS), redirect: "error" });
      ctx.add(res("J4", path, r.status === 200 ? "pass" : "fail", `HTTP ${r.status} ${r.headers.get("content-type") ?? ""}`.trim(), "200"));
    } catch (error) {
      ctx.add(res("J4", path, "fail", `request failed (${error?.name ?? "error"})`, "200"));
    }
  }
}

async function checkJ3(page, ctx) {
  const picker = page.locator('[data-card="live-figures"]');
  if ((await picker.count()) === 0) {
    const letter = page.locator("textarea").first();
    if ((await letter.count()) > 0) {
      // Typed only in the browser. Nothing is sent: the draft stays client-side until sealing.
      await letter.fill("Journey check.");
      await page.getByRole("button", { name: "Next", exact: true }).first().click().catch(() => {});
    }
    await picker.first().waitFor({ timeout: STAGE_TIMEOUT_MS }).catch(() => {});
  }
  const enabled = await page.locator('[data-card="live-figures"] input[type="checkbox"]:not([disabled])').count();
  ctx.add(res("J3", "/demo/live", enabled > 0 ? "pass" : "fail", `enabled=${enabled}`, ">=1"));
}

/**
 * J2 walk: open straight on the recall Stage (spec 10 C1, the persona First_Step),
 * "No answer" on every question, submit, break the seal, the figures button,
 * then close. Calls `atStage` at each Stage start so J5, J6, J7 and J8 run there.
 */
async function personaReveal(page, ctx, key, size, atStage) {
  const route = `/demo/personas/${key}`;
  const where = `${route} ${size}`;
  const fail = (m) => ctx.add(res("J2", where, "fail", m, "close reached, now value and retrieved date per entry"));
  const r = await page.goto(`${ctx.origin}${route}`, { waitUntil: "load" });
  if (!r || r.status() !== 200) return fail(`HTTP ${r?.status() ?? "none"}`);
  if (!(await waitForFirstStage(page))) return fail(`first Stage not reached (data-ceremony=${await stageOf(page)})`);
  await atStage("recall");
  for (let i = 0; i < 25; i += 1) {
    if ((await stageOf(page)) !== "recall") break;
    await page.getByLabel(NO_ANSWER, { exact: true }).first().check();
    const next = page.getByRole("button", { name: NEXT_QUESTION, exact: true });
    if ((await next.count()) > 0 && (await next.first().isVisible())) {
      await next.first().click();
      await sleep(300);
      continue;
    }
    await page.getByRole("button", { name: RECORD, exact: true }).first().click();
    break;
  }
  if (!(await waitForStage(page, ["marks", "seal"]))) return fail(`submit does not reach marks (data-ceremony=${await stageOf(page)})`);
  await atStage("marks");
  await page.getByRole("button", { name: BREAK_SEAL, exact: true }).first().click();
  if (!(await waitForStage(page, ["letter", "figures", "close"]))) return fail(`"${BREAK_SEAL}" does not reach letter`);
  await sleep(2500);
  await atStage("letter");
  if ((await stageOf(page)) === "letter") {
    const hooked = page.locator(FIGURES_HOOK);
    const button = (await hooked.count()) > 0 ? hooked.first() : page.getByRole("button", { name: FIGURES_LABEL }).first();
    await button.click();
  }
  if (!(await waitForStage(page, "close", 30_000))) return fail(`close not reached (data-ceremony=${await stageOf(page)})`);
  await sleep(1000);
  await atStage("close");
  const entries = await page.evaluate(() =>
    [...document.querySelectorAll("[data-figure-entry]")].map((entry) => {
      const now = entry.querySelector('[data-role="now"]');
      const row = now?.closest('[data-receipt-row="now"]') ?? now?.parentElement ?? null;
      return { now: !!now, retrieved: !!row && /retrieved\s+\S/.test(row.textContent ?? "") };
    }),
  );
  const bad = entries.filter((e) => !e.now || !e.retrieved).length;
  ctx.add(res("J2", where, entries.length && !bad ? "pass" : "fail", `entries=${entries.length} withoutNowOrRetrieved=${bad}`, "every entry has a now value and a retrieved date"));
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (error) {
    console.error(`journey-check: ${error.message}`);
    return 2;
  }
  const startedAt = Date.now();
  const runAtIso = new Date(startedAt).toISOString();
  const wanted = new Set(opts.require);
  const doReveal = wanted.has("J2") && revealRun(env.GITHUB_EVENT_NAME, startedAt, opts.reveal);
  const results = [];
  const ctx = {
    origin: new URL(opts.url).origin,
    wants: (id) => wanted.has(id),
    add: (r) => {
      results.push(r);
      console.log(formatLine(r));
    },
  };
  console.log(`Revenant journey check: ${ctx.origin} at ${runAtIso}. Checks: ${[...wanted].join(",")}. J2 this run: ${doReveal ? "yes" : "no (OD8)"}`);

  if (wanted.has("J1")) await checkJ1(ctx);
  if (wanted.has("J4")) await checkJ4(ctx);

  const browserChecks = ["J2", "J3", "J5", "J6", "J7", "J8"].some((id) => wanted.has(id));
  if (browserChecks) {
    const executablePath = opts.chromium ?? env.CHROMIUM_PATH ?? (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
    let chromium;
    let browser;
    try {
      ({ chromium } = await import("playwright-core"));
      browser = await chromium.launch({ executablePath, headless: true });
    } catch (error) {
      console.error(`journey-check: could not start the browser: ${String(error?.message ?? error).split("\n")[0]}`);
      return 2;
    }
    try {
      const plain = ["/", "/demo", "/demo/live", "/how-it-is-sealed"];
      for (const size of EVIDENCE_SIZES) {
        for (const route of plain) {
          const { context, page } = await newPage(browser, ctx.origin, size);
          try {
            const r = await page.goto(`${ctx.origin}${route}`, { waitUntil: "load" });
            if (!r || r.status() !== 200) {
              ctx.add(res("J5", `${route} ${size}`, "fail", `HTTP ${r?.status() ?? "none"}`, "200"));
              continue;
            }
            await sleep(500);
            if (wanted.has("J5")) {
              const w = await scrollWidth(page);
              ctx.add(res("J5", `${route} ${size}`, w.sw <= w.cw ? "pass" : "fail", `scrollWidth=${w.sw} clientWidth=${w.cw}`, "scrollWidth<=clientWidth"));
            }
            const phoneRoute = route === "/" || route === "/demo/live";
            await pageChecks(page, ctx, `${route} ${size}`, route, phoneRoute ? size : null);
            if (route === "/demo/live" && size === "1366x800" && wanted.has("J3")) await checkJ3(page, ctx);
          } catch (error) {
            ctx.add(res("J5", `${route} ${size}`, "fail", `page error: ${String(error?.message ?? error).split("\n")[0]}`, "page opens"));
          } finally {
            await context.close();
          }
        }
        // The persona pages' first Stage, at every size (J5), and J6 at the
        // Phone_Sizes unless this run walks the persona (J2 runs J6 per Stage).
        for (const key of PERSONAS) {
          const route = `/demo/personas/${key}`;
          if (doReveal && size === REVEAL_SIZE) continue;
          const { context, page } = await newPage(browser, ctx.origin, size);
          try {
            const r = await page.goto(`${ctx.origin}${route}`, { waitUntil: "load" });
            if (!r || r.status() !== 200 || !(await waitForFirstStage(page))) {
              ctx.add(res("J5", `${route} ${size}`, "fail", `HTTP ${r?.status() ?? "none"} stage=${await stageOf(page)}`, "first Stage reached"));
              continue;
            }
            await sleep(2600);
            const stage = await stageOf(page);
            if (wanted.has("J5")) {
              const w = await scrollWidth(page);
              ctx.add(res("J5", `${route} ${stage} ${size}`, w.sw <= w.cw ? "pass" : "fail", `scrollWidth=${w.sw} clientWidth=${w.cw}`, "scrollWidth<=clientWidth"));
            }
            await pageChecks(page, ctx, `${route} ${stage} ${size}`, route, size);
          } catch (error) {
            ctx.add(res("J5", `${route} ${size}`, "fail", `page error: ${String(error?.message ?? error).split("\n")[0]}`, "page opens"));
          } finally {
            await context.close();
          }
        }
      }
      if (doReveal) {
        for (const key of PERSONAS) {
          const route = `/demo/personas/${key}`;
          const { context, page } = await newPage(browser, ctx.origin, REVEAL_SIZE);
          try {
            await personaReveal(page, ctx, key, REVEAL_SIZE, async (stage) => {
              await sleep(stage === "recall" ? 2600 : 800);
              if (stage === "recall") {
                const w = await scrollWidth(page);
                if (wanted.has("J5")) ctx.add(res("J5", `${route} ${stage} ${REVEAL_SIZE}`, w.sw <= w.cw ? "pass" : "fail", `scrollWidth=${w.sw} clientWidth=${w.cw}`, "scrollWidth<=clientWidth"));
              }
              await pageChecks(page, ctx, `${route} ${stage} ${REVEAL_SIZE}`, route, REVEAL_SIZE);
            });
          } catch (error) {
            ctx.add(res("J2", `${route} ${REVEAL_SIZE}`, "fail", `walk error: ${String(error?.message ?? error).split("\n")[0]}`, "close reached"));
          } finally {
            await context.close();
          }
        }
      }
    } finally {
      await browser.close();
    }
  }

  const failed = results.filter((r) => r.status === "fail").length;
  console.log(`\nChecks: ${results.length}. Failed: ${failed}. Notes: ${results.filter((r) => r.status === "note").length}.`);
  let issueCode = 0;
  if (opts.issue) issueCode = await manageIssue(results, runAtIso, env);
  return failed || issueCode ? 1 : 0;
}

/** Applies planJourneyIssue through the GitHub REST API. Returns 1 on an API error. */
async function manageIssue(results, runAtIso, env) {
  const token = env.GITHUB_TOKEN;
  const repo = env.GITHUB_REPOSITORY;
  if (!token || !repo) {
    console.error("journey-check: GITHUB_TOKEN and GITHUB_REPOSITORY must be set (or pass --no-issue)");
    return 1;
  }
  const gh = async (method, path, payload) => {
    const r = await fetch(`https://api.github.com/repos/${repo}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(payload === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    return r;
  };
  try {
    const label = await gh("POST", "/labels", { name: LABEL, color: "b60205", description: "Journey check: a production judge-journey check failed" });
    if (!label.ok && label.status !== 422) throw Object.assign(new Error("github"), { status: label.status });
    const list = await gh("GET", `/issues?state=open&labels=${encodeURIComponent(LABEL)}&per_page=100`);
    if (!list.ok) throw Object.assign(new Error("github"), { status: list.status });
    const open = (await list.json()).filter((i) => !i.pull_request).sort((a, b) => a.number - b.number)[0] ?? null;
    const plan = planJourneyIssue(results, open, runAtIso);
    console.log(`journey-check action: ${plan.action}`);
    const ensure = async (p) => {
      const r = await p;
      if (!r.ok) throw Object.assign(new Error("github"), { status: r.status });
    };
    if (plan.action === "open") {
      await ensure(gh("POST", "/issues", { title: plan.title, body: plan.body, labels: plan.labels, assignees: plan.assignees }));
    } else if (plan.action === "comment") {
      await ensure(gh("POST", `/issues/${plan.issue}/comments`, { body: plan.body }));
    } else if (plan.action === "close") {
      await ensure(gh("POST", `/issues/${plan.issue}/comments`, { body: plan.body }));
      await ensure(gh("PATCH", `/issues/${plan.issue}`, { state: "closed", state_reason: "completed" }));
    }
    return 0;
  } catch (error) {
    console.error(`journey-check: GitHub API error (${error?.status ? `HTTP ${error.status}` : "network error"})`);
    return 1;
  }
}

const isEntry = (() => {
  try {
    return process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
})();

if (isEntry) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(`journey-check: ${error?.stack ?? error}`);
      process.exitCode = 2;
    },
  );
}
