// Pure helpers for tools/qa/layout-check.mjs and tools/qa/layout-baseline.mjs:
// the stage groups a run can be limited to, the identity of a BLOCKER, the
// blockers file a run saves, and matching a run's blockers against a baseline.
// Owner-only (tools/**). No browser, no file system: unit tests import it
// (src/lib/layout-check-baseline.test.ts).

// The parts of the site a run can be limited to with --stages. Every section of
// the check belongs to one group (some sections are split by page). A run
// without --stages runs every group.
export const STAGE_GROUPS = {
  landing: "the landing page /: the scene, the Emergence, sealed and error stages, the hero rows and its Soil strip",
  demo: "/demo: the persona cards, the persona seals, the demo rows and its Soil strip",
  persona: "the persona letters: the Maya and Tomás walks from recall to the close, Show everything, the fastest path, the persona rows and the persona receipts",
  live: "/demo/live: Write, Press the seal, the Top_Bar steps, the desk rows and the live receipts",
  "letter-page": "/l/<id>: the letter page an unknown id renders",
};
export const ALL_STAGE_GROUPS = Object.keys(STAGE_GROUPS);

// "persona,live" -> ["persona", "live"]. Throws on an unknown or empty group.
export function parseStages(value) {
  const groups = String(value ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (groups.length === 0) throw new Error(`--stages needs at least one of ${ALL_STAGE_GROUPS.join(",")}`);
  for (const g of groups) {
    if (!(g in STAGE_GROUPS)) throw new Error(`--stages: unknown stage group "${g}" (known: ${ALL_STAGE_GROUPS.join(",")})`);
  }
  return [...new Set(groups)];
}

// "1280x800, 390x844" -> ["1280x800", "390x844"]. Throws on a malformed size.
export function parseSizeList(value, flag = "--sizes") {
  const sizes = String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (sizes.length === 0) throw new Error(`${flag} needs at least one size, for example 1280x800`);
  for (const size of sizes) {
    if (!/^\d+x\d+$/.test(size)) throw new Error(`${flag}: size "${size}" must look like 1280x800`);
  }
  return sizes;
}

// True when a section in `group` at `size` runs, given the run's --stages and
// --only-sizes (null means "all").
/**
 * @param {{ group: string | string[], size?: string | null }} section
 * @param {{ stages?: string[] | null, onlySizes?: string[] | null }} [scope]
 */
export function sectionRuns({ group, size = null }, { stages = null, onlySizes = null } = {}) {
  const groups = Array.isArray(group) ? group : [group];
  if (stages && !groups.some((g) => stages.includes(g))) return false;
  if (onlySizes && size !== null && !onlySizes.includes(size)) return false;
  return true;
}

// The persona a stage belongs to, from the stage names the check uses: Tomás's
// walk stages carry "eu-tomas/", the persona row stages start with the key.
// Maya's walk keeps its spec 07 names (no prefix), so the walk passes her key itself.
export function personaOfStage(stage, keys = ["us-maya", "eu-tomas", "us-priya"]) {
  if (typeof stage !== "string") return "-";
  for (const key of keys) {
    if (stage === key || stage.startsWith(`${key}/`) || stage.startsWith(`${key}-`) || stage.startsWith(`${key} `)) return key;
  }
  return "-";
}

// A blocker's identity: check ID, row name, size, persona and stage. The detail
// (the measured values) is not part of it, so a blocker that moved by a pixel on
// main is still the same blocker.
export function blockerKey(b) {
  return [b.check ?? "-", b.name ?? "-", b.size ?? "-", b.persona ?? "-", b.stage ?? "-"].join("|");
}

export const BLOCKERS_FORMAT = "revenant-layout-blockers/1";

// The file --save-blockers writes. `rows` are the run's BLOCKER and polish rows
// (each with `level`); polish rows are kept so a later run with --require can
// tell that a row it makes a BLOCKER already failed on main. `run` describes
// what the run covered.
export function blockersFile({ rows, counts, run, complete }) {
  return {
    format: BLOCKERS_FORMAT,
    createdAt: new Date().toISOString(),
    complete: !!complete,
    run,
    counts,
    blockers: rows.map((b) => ({ level: b.level ?? "blocker", check: b.check, name: b.name ?? "-", size: b.size ?? "-", persona: b.persona ?? "-", stage: b.stage ?? "-", detail: b.detail ?? "" })),
  };
}

// Reads a parsed blockers file. Throws with a plain message when it is not one.
export function readBlockersFile(data) {
  if (!data || typeof data !== "object" || data.format !== BLOCKERS_FORMAT || !Array.isArray(data.blockers)) {
    throw new Error(`not a layout-check blockers file (want format "${BLOCKERS_FORMAT}")`);
  }
  for (const b of data.blockers) {
    if (!b || typeof b.check !== "string") throw new Error("a blocker in the baseline has no check ID");
  }
  return data;
}

// Marks each blocker of this run as new or already on main. A baseline blocker
// matches at most one blocker of this run, so two identical blockers where main
// has one count as one on main and one new. A polish row on main counts only
// when its check ID is in this run's --require list: --require is what makes
// that row a BLOCKER, so main with the same --require has it as a BLOCKER too.
// Returns the blockers in their order, each with `onMain: true|false`, and the
// two counts.
/**
 * @param {object[]} blockers
 * @param {object[]} baseline
 * @param {{ required?: string[] }} [options]
 */
export function matchBaseline(blockers, baseline, { required = [] } = {}) {
  const req = new Set(required);
  const left = new Map();
  for (const b of baseline) {
    if ((b.level ?? "blocker") !== "blocker" && !req.has(b.check)) continue;
    const k = blockerKey(b);
    left.set(k, (left.get(k) ?? 0) + 1);
  }
  const marked = blockers.map((b) => {
    const k = blockerKey(b);
    const n = left.get(k) ?? 0;
    if (n > 0) left.set(k, n - 1);
    return { ...b, onMain: n > 0 };
  });
  const onMain = marked.filter((b) => b.onMain).length;
  return { blockers: marked, onMain, fresh: marked.length - onMain };
}

// What this run covers that the baseline run did not: walk sizes, fixed sizes it
// filtered out, and stage groups. Blockers there can't match, so they count as new.
export function baselineGaps(baselineRun, run) {
  const gaps = [];
  if (!baselineRun) return ["the baseline does not say what it covered"];
  const bSizes = new Set(baselineRun.sizes ?? []);
  const missingSizes = (run.sizes ?? []).filter((s) => !bSizes.has(s));
  if (missingSizes.length) gaps.push(`walk sizes ${missingSizes.join(",")}`);
  if (baselineRun.onlySizes) {
    const bOnly = new Set(baselineRun.onlySizes);
    const extra = run.onlySizes ? run.onlySizes.filter((s) => !bOnly.has(s)) : ["sizes outside --only-sizes " + baselineRun.onlySizes.join(",")];
    if (extra.length) gaps.push(`sizes ${extra.join(",")}`);
  }
  const bStages = new Set(baselineRun.stages ?? ALL_STAGE_GROUPS);
  const missingStages = (run.stages ?? ALL_STAGE_GROUPS).filter((g) => !bStages.has(g));
  if (missingStages.length) gaps.push(`stage groups ${missingStages.join(",")}`);
  return gaps;
}

// The summary lines about blockers, with and without a baseline. Pure so the
// wording is tested.
/**
 * @param {{ counts: { blocker: number, polish: number, note: number }, marked?: { fresh: number, onMain: number } | null, incomplete?: string[], baselineNote?: string | null }} args
 */
export function summaryLines({ counts, marked = null, incomplete = [], baselineNote = null }) {
  const lines = [];
  if (marked) {
    lines.push(`Blockers: ${counts.blocker} (new: ${marked.fresh}, already on main: ${marked.onMain})   Polish: ${counts.polish}   Not reached: ${counts.note}`);
  } else {
    lines.push(`Blockers: ${counts.blocker}   Polish: ${counts.polish}   Not reached: ${counts.note}`);
  }
  if (baselineNote) lines.push(`Baseline: ${baselineNote}`);
  if (incomplete.length) lines.push(`Incomplete: ${incomplete.join("; ")}`);
  return lines;
}

// The Result line and the exit code. With a baseline only new blockers count.
// 0: no (new) blocker, 1: at least one, 3: no (new) blocker but the run did not finish.
/**
 * @param {{ counts: { blocker: number, polish: number, note: number }, marked?: { fresh: number, onMain: number } | null, incomplete?: string[] }} args
 */
export function resultOf({ counts, marked = null, incomplete = [] }) {
  const blockers = marked ? marked.fresh : counts.blocker;
  if (blockers > 0) {
    const tail = marked ? ` (${marked.fresh} new blocker${marked.fresh === 1 ? "" : "s"}, ${marked.onMain} already on main)` : " (blockers)";
    return { line: `Result: FAIL${tail}`, code: 1 };
  }
  if (incomplete.length) return { line: "Result: INCOMPLETE (the run did not finish; see Incomplete above)", code: 3 };
  if (marked) return { line: `Result: PASS (no new blockers${marked.onMain ? `; ${marked.onMain} already on main` : ""})`, code: 0 };
  return { line: "Result: PASS (no blockers)", code: 0 };
}
