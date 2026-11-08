#!/usr/bin/env node
// Crew agent hook (frontend-dev, "stop" event): tone and neutrality check on the
// files changed in this run. Owner-only (tools/** is denied to agents).
//
// Usage: node tools/hooks/tone-check.mjs --role <role>
//
// Changed files = git diff --name-only against the merge-base with origin/main
// (committed and uncommitted), plus untracked files, filtered to:
//   src/app/**/*.tsx, src/components/**, content/personas/**
// Rules come from .kiro/steering/tone.md and neutrality.md.
//
// On hits it prints {"decision":"block","reason":"..."} so the agent takes
// another turn. It blocks at most once per session_id (marker under the OS temp
// dir, outside the repo). A second stop in the same session prints the findings
// but does not block. Errors, missing session_id and garbage input never block:
// the script always exits 0. Every run appends one line to
// ~/kiro/revenant-crew/hooks.log (outside the repo).
import { readFileSync, existsSync, mkdirSync, appendFileSync, writeFileSync } from "node:fs";
import { resolve, relative, sep, extname, basename, join } from "node:path";
import { homedir, tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const HOOK_NAME = "tone-check";
const LOG_FILE = join(homedir(), "kiro", "revenant-crew", "hooks.log");

const JUDGEMENT = [
  "soared", "plunged", "skyrocketed", "finally",
  "cheaper", "dearer", "better", "worse",
];
const TEXT_EXT = new Set([".tsx", ".ts", ".md", ".txt", ".mdx"]);
const WORD_RE = new RegExp(`\\b(${JUDGEMENT.join("|")})\\b`, "i");
// Class tokens that colour or point a change value as good/bad.
const CLASS_TOKEN_RE =
  /(?:^|[\s"'`._-])(red|green|arrow|arrows|up|down|positive|negative|rise|fall|gain|loss)(?=$|[\s"'`._-])/i;
const CHANGE_CONTEXT_RE = /change|delta|diff|rise|fall|trend/i;

// Spec 07 (judge journey), design.md "Patterns for tools/hooks/tone-check.mjs".
// T1: scoring words checked in every file this hook scans (Scoring_Words_Always).
// Spec 10 S3.3 adds "accurate": no answer is ever called accurate.
const SCORING_ALWAYS_RE = /\b(accuracy|accurate|score|off by)\b/i;
// T2: "close", "right" and "wrong" only in the Scene copy modules, inside string
// literals (Scoring_Words_Scene). Never src/components/live/copy.ts.
const SCENE_COPY_FILES = new Set([
  "src/components/ceremony/copy.ts",
  "src/components/reveal/copy.ts",
  "src/components/ceremony/scene/copy.ts",
  "src/components/demo/copy.ts",
]);
// Spec 10 S3.3 adds "near": no answer is ever called near.
const SCORING_SCENE_RE = /\b(close|right|wrong|near)\b/i;
// Spec 10 S3 (design.md "Owner patches", ac): copy a spec 10 task removed. Each
// phrase joins this list in the task that removes it (ac-4, ac-5, ac-10), so the
// hook never asks an agent to remove a string a later task owns. Matched
// case-insensitively in every scanned file, except the copy-test records under
// content/personas/letters/, which record the removals.
const RETIRED_PHRASES = [];
const COPY_TEST_RECORD_RE = /^content\/personas\/letters\/[^/]+-copy-test\.md$/;
// T3: the Accent class next to a figure, change, formula, period, source or
// direction class on one className line.
const FIGURE_CLASS = "(?:big|now\\w*|change\\w*|formula\\w*|meta|period\\w*|src|source\\w*|pin\\w*|axis|direction\\w*)";
const ACCENT_ON_FIGURE_TSX_RE = new RegExp(
  `className=[^>\\n]*styles\\.${FIGURE_CLASS}\\b[^>\\n]*styles\\.accent\\w*|className=[^>\\n]*styles\\.accent\\w*[^>\\n]*styles\\.${FIGURE_CLASS}\\b`,
);
// T4: a figure, change, formula, source or direction rule in a CSS module that
// uses the Accent or the wax colour.
const ACCENT_ON_FIGURE_CSS_RE =
  /\.(big|nowLine|change\w*|formula\w*|meta|src|pin\w*|axis|direction\w*)\b[^{]*\{[^}]*var\(--(accent|wax)\)/gs;

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function log(role, files, result) {
  try {
    mkdirSync(join(homedir(), "kiro", "revenant-crew"), { recursive: true });
    const list = files.length ? files.join(",") : "-";
    appendFileSync(
      LOG_FILE,
      `${new Date().toISOString()} role=${role} hook=${HOOK_NAME} files=${files.length} [${list}] result=${result}\n`,
    );
  } catch {
    // Logging must never affect the run.
  }
}

function isRelevant(rel) {
  const parts = rel.split("/");
  const name = basename(rel);
  if (/\.test\.[a-z]+$/.test(name) || /\.spec\.[a-z]+$/.test(name)) return false;
  if (name.endsWith(".module.css")) return parts[0] === "src" && parts[1] === "components";
  if (!TEXT_EXT.has(extname(rel))) return false;
  if (rel.startsWith("src/app/") && extname(rel) === ".tsx") return true;
  if (parts[0] === "src" && parts[1] === "components") return true;
  if (rel.startsWith("content/personas/")) return true;
  return false;
}

function git(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 20000,
  });
}

function changedFiles(cwd) {
  let base = "";
  for (const ref of ["origin/main", "main"]) {
    try {
      base = git(cwd, ["merge-base", "HEAD", ref]).trim();
      if (base) break;
    } catch {
      // try the next ref
    }
  }
  const names = new Set();
  const add = (out) => out.split("\n").map((s) => s.trim()).filter(Boolean).forEach((n) => names.add(n));
  if (base) add(git(cwd, ["diff", "--name-only", base]));
  else add(git(cwd, ["diff", "--name-only", "HEAD"]));
  add(git(cwd, ["ls-files", "--others", "--exclude-standard"]));
  return [...names].filter(isRelevant).filter((n) => existsSync(resolve(cwd, n))).sort();
}

// The text a reader sees on this line: quoted strings and JSX text for code
// files, the whole line for prose files. Keeps code like `!x` or `better` as an
// identifier from being flagged.
function visibleText(line, isCode) {
  if (!isCode) return line;
  const out = [];
  for (const m of line.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)) out.push(m[2]);
  for (const m of line.matchAll(/>([^<>{}]+)</g)) out.push(m[1]);
  // JSX text on its own line, e.g. "  Your seal is intact!"
  if (/^\s*[A-Za-z][^=;(){}<>]*$/.test(line) && !/^\s*(import|export|return|const|let|var|type|interface)\b/.test(line)) {
    out.push(line);
  }
  return out.join(" ");
}

// T4 runs on CSS modules only; no other rule applies to them.
function scanCss(rel, text) {
  const hits = [];
  for (const m of text.matchAll(ACCENT_ON_FIGURE_CSS_RE)) {
    const n = text.slice(0, m.index).split("\n").length;
    hits.push(`${rel}:${n}: ".${m[1]}" uses var(--${m[2]}) (spec 07 R3.10: orange is never on a figure, change or direction)`);
  }
  return hits;
}

function scan(rel, text) {
  if (rel.endsWith(".module.css")) return scanCss(rel, text);
  const isCode = extname(rel) === ".tsx" || extname(rel) === ".ts";
  const sceneCopy = SCENE_COPY_FILES.has(rel);
  const hits = [];
  if (!COPY_TEST_RECORD_RE.test(rel)) {
    const lower = text.toLowerCase();
    for (const phrase of RETIRED_PHRASES) {
      let at = lower.indexOf(phrase.toLowerCase());
      while (at >= 0) {
        const n = text.slice(0, at).split("\n").length;
        hits.push(`${rel}:${n}: retired phrase "${phrase}" (spec 10 S3)`);
        at = lower.indexOf(phrase.toLowerCase(), at + phrase.length);
      }
    }
  }
  let inBlockComment = false;
  text.split("\n").forEach((raw, i) => {
    const n = i + 1;
    let line = raw;
    if (inBlockComment) {
      if (line.includes("*/")) inBlockComment = false;
      return;
    }
    if (isCode) {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
      if (trimmed.startsWith("/*") && !trimmed.includes("*/")) {
        inBlockComment = true;
        return;
      }
      if (/^\s*import\b/.test(line)) return;
      line = line.replace(/\/\/.*$/, "");
    }
    const seen = visibleText(line, isCode);
    if (/!/.test(seen.replace(/!==?/g, ""))) {
      hits.push(`${rel}:${n}: exclamation mark (tone.md: no exclamation marks)`);
    }
    const w = seen.match(WORD_RE);
    if (w) {
      hits.push(`${rel}:${n}: judgemental word "${w[1]}" (neutrality.md: describe the change, do not rate it)`);
    }
    const sw = seen.match(SCORING_ALWAYS_RE);
    if (sw) {
      hits.push(`${rel}:${n}: scoring word "${sw[1]}" (spec 07 R24.6: the gap between memory and record is never scored)`);
    }
    if (sceneCopy) {
      const literals = [...line.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)].map((m) => m[2]).join(" ");
      const ss = literals.match(SCORING_SCENE_RE);
      if (ss) {
        hits.push(`${rel}:${n}: scoring word "${ss[1]}" in Scene copy (spec 07 R24.7)`);
      }
    }
    if (extname(rel) === ".tsx" && ACCENT_ON_FIGURE_TSX_RE.test(line)) {
      hits.push(`${rel}:${n}: accent class on a figure, change or direction element (spec 07 R3.10)`);
    }
    if (isCode && /class(Name)?\s*=|styles\.|clsx|classNames/.test(line)) {
      const cls = line.match(CLASS_TOKEN_RE);
      if (cls && CHANGE_CONTEXT_RE.test(line)) {
        hits.push(`${rel}:${n}: class "${cls[1]}" on a change value (neutrality.md: up and down get the same treatment)`);
      }
    }
  });
  return hits;
}

function main(role) {
  let event;
  try {
    event = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    log(role, [], "skipped:bad-input");
    return;
  }
  const cwd = typeof event?.cwd === "string" && event.cwd ? event.cwd : process.cwd();
  const sessionId = typeof event?.session_id === "string" ? event.session_id : "";

  let files;
  try {
    files = changedFiles(cwd);
  } catch (err) {
    log(role, [], `skipped:git-error`);
    return;
  }
  if (files.length === 0) {
    log(role, [], "clean:no-relevant-files");
    return;
  }

  const hits = [];
  for (const f of files) hits.push(...scan(f, readFileSync(resolve(cwd, f), "utf8")));
  if (hits.length === 0) {
    log(role, files, "clean");
    return;
  }

  const shown = hits.slice(0, 20);
  const findings =
    shown.join("\n") + (hits.length > shown.length ? `\n...and ${hits.length - shown.length} more` : "");

  // Block at most once per session. No session id: report, never block.
  let canBlock = false;
  if (/^[A-Za-z0-9._-]{1,128}$/.test(sessionId)) {
    const dir = join(tmpdir(), "revenant-hooks");
    const marker = join(dir, `${HOOK_NAME}-${sessionId}`);
    if (!existsSync(marker)) {
      try {
        mkdirSync(dir, { recursive: true });
        writeFileSync(marker, new Date().toISOString());
        canBlock = true;
      } catch {
        canBlock = false;
      }
    }
  }

  if (canBlock) {
    const reason =
      `tone-check found ${hits.length} issue(s):\n${findings}\n` +
      `Fix these per .kiro/steering/tone.md and neutrality.md, then finish.`;
    console.log(JSON.stringify({ decision: "block", reason }));
    log(role, files, `block:${hits.length}`);
  } else {
    console.log(`tone-check: ${hits.length} issue(s) remain (not blocking again):\n${findings}`);
    log(role, files, `report:${hits.length}`);
  }
}

const role = argValue("--role") ?? "unknown";
try {
  main(role);
} catch {
  log(role, [], "skipped:error");
}
process.exit(0);
