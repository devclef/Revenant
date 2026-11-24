import { describe, expect, it } from "vitest";

import { makeReport, parseArgs, planSections, quietKeeps } from "../../tools/qa/layout-check.mjs";
import { baselineName } from "../../tools/qa/layout-baseline.mjs";
import {
  ALL_STAGE_GROUPS,
  baselineGaps,
  blockerKey,
  blockersFile,
  matchBaseline,
  parseSizeList,
  parseStages,
  personaOfStage,
  readBlockersFile,
  resultOf,
  sectionRuns,
  summaryLines,
} from "../../tools/qa/layout-scope.mjs";

/**
 * Unit tests for the pure parts of the layout-check speed and scope change: the new
 * arguments, which sections a scoped run keeps, blocker identity, matching a run
 * against the main baseline, the summary and Result lines, and the baseline cache name.
 * No browser and no app.
 */

const URL_ARGS = ["--url", "http://localhost:3000/demo"];
const blocker = (over: Record<string, string> = {}) => ({ check: "W1", name: "letter-width", size: "360x640", persona: "-", stage: "letter", detail: "28.1em", ...over });

describe("parseArgs", () => {
  it("keeps the old defaults when no new flag is given", () => {
    const opts = parseArgs(URL_ARGS);
    expect(opts.url).toBe("http://localhost:3000");
    expect(opts.sizes).toEqual(["1366x800", "1280x800", "360x640", "390x844", "2560x1440"]);
    expect(opts.stages).toBeNull();
    expect(opts.onlySizes).toBeNull();
    expect(opts.quiet).toBe(false);
    expect(opts.jobs).toBe(4);
    expect(opts.baseline).toBeNull();
    expect(opts.saveBlockers).toBeNull();
  });

  it("reads --stages, --only-sizes, --quiet, --jobs, --baseline and --save-blockers", () => {
    const opts = parseArgs([...URL_ARGS, "--stages", "persona, live", "--only-sizes", "1280x800,1440x900,390x844", "--quiet", "--jobs", "2", "--baseline", "main", "--save-blockers", "out/b.json"]);
    expect(opts.stages).toEqual(["persona", "live"]);
    expect(opts.onlySizes).toEqual(["1280x800", "1440x900", "390x844"]);
    expect(opts.quiet).toBe(true);
    expect(opts.jobs).toBe(2);
    expect(opts.baseline).toBe("main");
    expect(opts.saveBlockers).toBe("out/b.json");
  });

  it("cuts the walk sizes to --only-sizes", () => {
    expect(parseArgs([...URL_ARGS, "--only-sizes", "1280x800,1440x900,390x844"]).sizes).toEqual(["1280x800", "390x844"]);
    expect(parseArgs([...URL_ARGS, "--only-sizes", "1440x900"]).sizes).toEqual([]);
  });

  it("rejects an unknown stage group, a bad size and a bad job count", () => {
    expect(() => parseArgs([...URL_ARGS, "--stages", "recall"])).toThrow(/unknown stage group "recall"/);
    expect(() => parseArgs([...URL_ARGS, "--only-sizes", "1280-800"])).toThrow(/must look like 1280x800/);
    expect(() => parseArgs([...URL_ARGS, "--jobs", "0"])).toThrow(/--jobs/);
    expect(() => parseArgs([...URL_ARGS, "--jobs", "two"])).toThrow(/--jobs/);
    expect(() => parseArgs([...URL_ARGS, "--baseline"])).toThrow(/needs a value/);
  });
});

describe("parseStages and parseSizeList", () => {
  it("lowercases, trims and drops repeats", () => {
    expect(parseStages(" Live,live ,persona")).toEqual(["live", "persona"]);
    expect(parseSizeList("390x844, 1280x800")).toEqual(["390x844", "1280x800"]);
  });

  it("needs at least one entry", () => {
    expect(() => parseStages("")).toThrow(/at least one/);
    expect(() => parseSizeList(" , ")).toThrow(/at least one size/);
  });
});

describe("planSections", () => {
  it("runs every section of the old run, in the old order, by default", () => {
    const names = planSections(parseArgs(URL_ARGS)).map((s: { name: string }) => s.name);
    expect(names.slice(0, 5)).toEqual(["walk 1366x800", "walk 1280x800", "walk 360x640", "walk 390x844", "walk 2560x1440"]);
    expect(names).toContain("U9 1440x900");
    expect(names).toContain("desk rows 1055x900");
    expect(names).toContain("Top_Bar steps 360x640");
    expect(names).toContain("eu-tomas rows 360x640");
    expect(names.at(-3)).toBe("Soil strips 1440x900");
    expect(names.slice(-2)).toEqual(["spec 16 rows 1440x900", "spec 16 rows 390x844"]);
    expect(names).toHaveLength(5 + 2 + 4 + 2 + 2 + 6 + 1 + 2);
  });

  it("keeps one desktop and one phone size for the dev run", () => {
    const sizes = new Set(planSections(parseArgs([...URL_ARGS, "--only-sizes", "1280x800,1440x900,390x844"])).map((s: { size: string }) => s.size));
    expect([...sizes].sort()).toEqual(["1280x800", "1440x900", "390x844"]);
  });

  it("keeps only the sections of the chosen stage groups", () => {
    const names = planSections(parseArgs([...URL_ARGS, "--stages", "demo", "--only-sizes", "1440x900,390x844"])).map((s: { name: string }) => s.name);
    expect(names).toEqual(["walk 390x844", "U9 1440x900", "U9 390x844", "demo rows 1440x900", "demo rows 390x844", "Soil strips 1440x900"]);
  });
});

describe("sectionRuns", () => {
  it("runs a section when one of its groups is chosen and its size is kept", () => {
    expect(sectionRuns({ group: ["persona", "live"], size: "390x844" }, { stages: ["live"], onlySizes: ["390x844"] })).toBe(true);
    expect(sectionRuns({ group: "demo", size: "390x844" }, { stages: ["live"] })).toBe(false);
    expect(sectionRuns({ group: "live", size: "1055x900" }, { onlySizes: ["1440x900"] })).toBe(false);
    expect(sectionRuns({ group: "live", size: "1055x900" }, {})).toBe(true);
  });
});

describe("blocker identity", () => {
  it("is the check ID, row name, size, persona and stage, not the measured detail", () => {
    expect(blockerKey(blocker())).toBe(blockerKey(blocker({ detail: "27.9em" })));
    for (const field of ["check", "name", "size", "persona", "stage"]) {
      expect(blockerKey(blocker())).not.toBe(blockerKey(blocker({ [field]: "other" })));
    }
  });

  it("reads the persona from the stage names the check uses", () => {
    expect(personaOfStage("eu-tomas/letter")).toBe("eu-tomas");
    expect(personaOfStage("us-maya-recall")).toBe("us-maya");
    expect(personaOfStage("us-maya receipts")).toBe("us-maya");
    expect(personaOfStage("letter")).toBe("-");
    expect(personaOfStage(null)).toBe("-");
  });

  it("puts the persona of the walk on each row", () => {
    const lines: { kind: string; text: string }[] = [];
    const rep = makeReport((l: { kind: string; text: string }) => lines.push(l));
    rep.setContext({ size: "360x640", stage: null, persona: "us-maya" });
    rep.stage("letter");
    rep.add("blocker", "W1", "28.1em", "letter-width");
    rep.setContext({ size: "360x640", stage: "eu-tomas/letter" });
    rep.add("polish", "W1", "27em", "letter-width");
    expect(rep.items).toEqual([expect.objectContaining({ persona: "us-maya", stage: "letter", check: "W1", name: "letter-width", size: "360x640" })]);
    expect(rep.rows.map((r: { persona: string }) => r.persona)).toEqual(["us-maya", "eu-tomas"]);
    expect(lines.find((l) => l.kind === "blocker")?.text).toBe("  BLOCKER W1    letter-width   360x640 letter 28.1em");
  });
});

describe("matchBaseline", () => {
  it("marks a blocker main already has as on main and the rest as new", () => {
    const m = matchBaseline([blocker(), blocker({ size: "390x844" }), blocker({ check: "N1", name: "numbers-focus" })], [blocker({ detail: "x" }), blocker({ size: "390x844" })]);
    expect(m.blockers.map((b: { onMain: boolean }) => b.onMain)).toEqual([true, true, false]);
    expect(m.onMain).toBe(2);
    expect(m.fresh).toBe(1);
  });

  it("lets one baseline blocker match one blocker only", () => {
    const m = matchBaseline([blocker(), blocker()], [blocker()]);
    expect(m.onMain).toBe(1);
    expect(m.fresh).toBe(1);
  });

  it("counts a polish row on main only when --require makes that check a blocker", () => {
    const polishOnMain = [{ ...blocker({ check: "BO1", name: "button-overflow" }), level: "polish" }];
    const run = [blocker({ check: "BO1", name: "button-overflow" })];
    expect(matchBaseline(run, polishOnMain).fresh).toBe(1);
    expect(matchBaseline(run, polishOnMain, { required: ["BO1"] }).onMain).toBe(1);
  });

  it("calls every blocker new against an empty baseline", () => {
    expect(matchBaseline([blocker()], []).fresh).toBe(1);
  });
});

describe("blockers file", () => {
  it("round-trips through readBlockersFile", () => {
    const rows = [{ ...blocker(), level: "blocker" }, { ...blocker({ check: "T2" }), level: "polish" }];
    const file = JSON.parse(JSON.stringify(blockersFile({ rows, counts: { blocker: 1, polish: 1, note: 0 }, run: { sizes: ["360x640"], onlySizes: null, stages: null }, complete: true })));
    const data = readBlockersFile(file);
    expect(data.blockers.map((b: { level: string }) => b.level)).toEqual(["blocker", "polish"]);
    expect(data.complete).toBe(true);
  });

  it("rejects a file that is not one", () => {
    expect(() => readBlockersFile({ blockers: [] })).toThrow(/not a layout-check blockers file/);
    expect(() => readBlockersFile(null)).toThrow(/not a layout-check blockers file/);
  });
});

describe("baselineGaps", () => {
  const full = { sizes: ["1366x800", "1280x800", "360x640", "390x844", "2560x1440"], onlySizes: null, stages: null };

  it("finds no gap for a scoped run inside the full baseline", () => {
    expect(baselineGaps(full, { sizes: ["1280x800", "390x844"], onlySizes: ["1280x800", "1440x900", "390x844"], stages: ["live"] })).toEqual([]);
  });

  it("names walk sizes, stage groups and filtered sizes the baseline did not cover", () => {
    expect(baselineGaps(full, { sizes: ["1024x768"], onlySizes: null, stages: null })).toEqual(["walk sizes 1024x768"]);
    expect(baselineGaps({ ...full, stages: ["live"] }, { sizes: [], onlySizes: null, stages: ALL_STAGE_GROUPS })).toEqual(["stage groups landing,demo,persona,letter-page"]);
    expect(baselineGaps({ ...full, onlySizes: ["390x844"] }, { sizes: [], onlySizes: null, stages: null })).toHaveLength(1);
  });
});

describe("summary and Result lines", () => {
  const counts = { blocker: 4, polish: 10, note: 7 };

  it("keeps the old lines without a baseline", () => {
    expect(summaryLines({ counts })).toEqual(["Blockers: 4   Polish: 10   Not reached: 7"]);
    expect(resultOf({ counts })).toEqual({ line: "Result: FAIL (blockers)", code: 1 });
    expect(resultOf({ counts: { blocker: 0, polish: 1, note: 0 } })).toEqual({ line: "Result: PASS (no blockers)", code: 0 });
  });

  it("counts only new blockers with a baseline and prints both counts", () => {
    const marked = { fresh: 0, onMain: 4 };
    expect(summaryLines({ counts, marked, baselineNote: "main abc (cached)" })).toEqual([
      "Blockers: 4 (new: 0, already on main: 4)   Polish: 10   Not reached: 7",
      "Baseline: main abc (cached)",
    ]);
    expect(resultOf({ counts, marked })).toEqual({ line: "Result: PASS (no new blockers; 4 already on main)", code: 0 });
    expect(resultOf({ counts, marked: { fresh: 1, onMain: 3 } })).toEqual({ line: "Result: FAIL (1 new blocker, 3 already on main)", code: 1 });
  });

  it("says when the run did not finish", () => {
    const zero = { blocker: 0, polish: 0, note: 0 };
    expect(summaryLines({ counts: zero, incomplete: ["walk 360x640 (stopped by SIGTERM)"] })).toContain("Incomplete: walk 360x640 (stopped by SIGTERM)");
    expect(resultOf({ counts: zero, incomplete: ["x"] }).code).toBe(3);
    expect(resultOf({ counts, incomplete: ["x"] }).code).toBe(1);
  });
});

describe("quietKeeps", () => {
  it("keeps BLOCKER lines and could-not-run notes only", () => {
    expect(quietKeeps({ kind: "blocker", text: "" })).toBe(true);
    expect(quietKeeps({ kind: "note", couldNotRun: true, text: "" })).toBe(true);
    expect(quietKeeps({ kind: "note", couldNotRun: false, text: "" })).toBe(false);
    expect(quietKeeps({ kind: "polish", text: "" })).toBe(false);
    expect(quietKeeps({ kind: "ok", text: "" })).toBe(false);
    expect(quietKeeps({ kind: "stage", text: "" })).toBe(false);
  });

  it("marks a guarded check that threw as could not run", () => {
    const lines: { kind: string; couldNotRun?: boolean }[] = [];
    const rep = makeReport((l: { kind: string; couldNotRun?: boolean }) => lines.push(l));
    rep.setContext({ size: "390x844", stage: "seal" });
    rep.add("note", "S", "could not run: locator.click: Timeout 30000ms exceeded.");
    rep.add("note", "S2", "not on this build: no #live-letter on /demo/live");
    expect(lines.map((l) => l.couldNotRun)).toEqual([true, false]);
  });
});

describe("baselineName", () => {
  const key = "0123456789abcdef0123456789abcdef01234567";

  it("is the key when the check scripts are main's", () => {
    expect(baselineName({ key, scripts: ["a", "b"], mainScripts: ["a", "b"] })).toBe(`${key}.json`);
  });

  it("carries a script hash when a check script differs or is new", () => {
    const changed = baselineName({ key, scripts: ["a", "c"], mainScripts: ["a", "b"] });
    expect(changed).toMatch(new RegExp(`^${key}-script-[0-9a-f]{12}\\.json$`));
    expect(baselineName({ key, scripts: ["a", "b"], mainScripts: ["a", null] })).not.toBe(`${key}.json`);
    expect(baselineName({ key, scripts: ["a", "c"], mainScripts: ["x", "y"] })).toBe(changed);
  });

  it("rejects something that is not a cache key", () => {
    expect(() => baselineName({ key: "main", scripts: [], mainScripts: [] })).toThrow(/not a cache key/);
  });
});
