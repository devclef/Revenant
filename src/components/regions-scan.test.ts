import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Scans user-facing copy for Swedish-region wording that the MVP must not show
// outside the Sweden region. The scan reads only the files listed below. It
// never reads test files, __recorded__ fixtures or guard lists.

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const COMPONENTS_DIR = join(ROOT, "src", "components");

const BANNED_CASE_INSENSITIVE = ["Swed", "SCB", "sv-SE"];
const BANNED_WHOLE_WORD = /\bSEK\b/i;

function findCopyModules(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...findCopyModules(full));
    } else if (entry.isFile() && entry.name === "copy.ts") {
      found.push(full);
    }
  }
  return found.sort();
}

const SCANNED_FILES = [
  join(ROOT, "README.md"),
  ...findCopyModules(COMPONENTS_DIR),
  join(ROOT, "src", "app", "how-it-is-sealed", "page.tsx"),
  join(ROOT, "src", "lib", "figures", "catalogue.ts"),
  join(ROOT, "src", "lib", "figures", "locale.ts"),
  join(ROOT, "src", "lib", "figures", "format-change.ts"),
];

type Match = { file: string; line: number; text: string; term: string };

function scanFile(file: string): Match[] {
  const matches: Match[] = [];
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((text, index) => {
    for (const term of BANNED_CASE_INSENSITIVE) {
      if (text.toLowerCase().includes(term.toLowerCase())) {
        matches.push({ file, line: index + 1, text: text.trim(), term });
      }
    }
    const whole = BANNED_WHOLE_WORD.exec(text);
    if (whole) {
      matches.push({ file, line: index + 1, text: text.trim(), term: whole[0] });
    }
  });
  return matches;
}

function describeMatches(matches: Match[]): string {
  return matches
    .map((m) => `${relative(ROOT, m.file)}:${m.line} matches "${m.term}": ${m.text}`)
    .join("\n");
}

describe("regions scan: no Swedish-region wording in scanned copy", () => {
  it("scans every expected file", () => {
    for (const file of SCANNED_FILES) {
      expect(() => readFileSync(file, "utf8")).not.toThrow();
    }
  });

  it("scans the landing hero copy module (landing/copy.ts)", () => {
    const landingCopy = join(COMPONENTS_DIR, "landing", "copy.ts");
    expect(SCANNED_FILES).toContain(landingCopy);
  });

  it("finds no banned term in README, copy modules, the how-it-is-sealed page or the figures modules", () => {
    const matches = SCANNED_FILES.flatMap(scanFile);
    expect(matches, describeMatches(matches)).toEqual([]);
  });
});

// Recorded decisions for the scan below. The owner writes each decision here
// when it is made, in the same change as the copy edit it allows:
// - cutTasks: task ids from spec 09 tasks.md that were cut at the 27 November
//   2026 freeze (G3.5). Their wording must then be gone from the copy.
// - realSealing: the 20 November 2026 go or no-go (spec 08 R25). "undecided"
//   until it is recorded. On "no-go", no copy may promise real sealing.
// Nothing is cut and no decision is recorded yet, so both read as open.
const RECORDED_DECISIONS = {
  cutTasks: [] as readonly CutTaskId[],
  realSealing: "undecided" as "undecided" | "go" | "no-go",
};

type CutTaskId = "D3" | "C5" | "B3.4" | "B3.5";

// Wording that depends on a cut task. Each phrase is the exact text in the copy
// modules today. Source: spec 09 tasks.md, task 24 and the G3.5 cut order.
const CUT_TASK_WORDING: readonly {
  task: CutTaskId;
  description: string;
  phrases: readonly RegExp[];
}[] = [
  {
    task: "D3",
    description: "prompt starters (task 22)",
    phrases: [
      /Start with one of these sentences/i,
      /Right now, the thing on my mind is/i,
      /Today, the thing I most want to remember is/i,
      /Over the past few months, I have been/i,
    ],
  },
  {
    task: "C5",
    description: "held seal (task 20)",
    phrases: [/Press and hold/i, /The seal holds\./i],
  },
  {
    task: "B3.4",
    description: "Sample_Receipt (tasks 10 and 12)",
    phrases: [
      /A receipt from the record/i,
      /No figure is available to show right now/i,
      /Check the figure at its source/i,
    ],
  },
  {
    task: "B3.5",
    description: "Coven_Strip (tasks 10 and 12)",
    phrases: [
      /Built by a coven of Kiro agents/i,
      /Browse the \.kiro folder on GitHub/i,
      /Read how the agent loop works/i,
    ],
  },
];

// Wording that promises a reader can seal a real letter. Demo-only wording
// (the 30-second lock) is left out on purpose: it is not a real-sealing claim.
const REAL_SEALING_WORDING: readonly RegExp[] = [
  /lock it with your passkey/i,
  /count as test letters/i,
  /Your letter is sealed with your own passkey/i,
];

// The real-sealing wording the copy holds while the decision is open. Each entry
// is a copy file and the phrase found in it. The test fails if a new match
// appears, so new real-sealing wording gets owner review. Remove an entry when
// the copy that holds it changes.
const HELD_FOR_OWNER: readonly string[] = [
  "src/components/brand/copy.ts|lock it with your passkey",
  "src/components/how/copy.ts|count as test letters",
  "src/components/live/copy.ts|Your letter is sealed with your own passkey",
];

type PhraseMatch = { file: string; line: number; text: string; phrase: string };

function scanPhrases(
  files: readonly string[],
  patterns: readonly RegExp[],
): PhraseMatch[] {
  const matches: PhraseMatch[] = [];
  for (const file of files) {
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((text, index) => {
      for (const pattern of patterns) {
        const hit = pattern.exec(text);
        if (hit) {
          matches.push({
            file,
            line: index + 1,
            text: text.trim(),
            phrase: hit[0],
          });
        }
      }
    });
  }
  return matches;
}

function describePhraseMatches(matches: PhraseMatch[]): string {
  return matches
    .map(
      (m) =>
        `${relative(ROOT, m.file)}:${m.line} matches "${m.phrase}": ${m.text}`,
    )
    .join("\n");
}

const COPY_MODULES = findCopyModules(COMPONENTS_DIR);

describe("regions scan: no cut-task or real-sealing wording against the recorded decisions", () => {
  it("scans the copy modules that hold the cut-task and seal wording", () => {
    const relativePaths = COPY_MODULES.map((file) => relative(ROOT, file));
    expect(relativePaths).toContain(
      join("src", "components", "landing", "copy.ts"),
    );
    expect(relativePaths).toContain(
      join("src", "components", "live", "copy.ts"),
    );
    expect(relativePaths).toContain(
      join("src", "components", "ceremony", "copy.ts"),
    );
    expect(relativePaths).toContain(
      join("src", "components", "brand", "copy.ts"),
    );
  });

  it("names only known cut tasks in the recorded decisions", () => {
    const known = CUT_TASK_WORDING.map((entry) => entry.task);
    for (const task of RECORDED_DECISIONS.cutTasks) {
      expect(known).toContain(task);
    }
  });

  it("finds no wording for a task recorded as cut", () => {
    const cut = CUT_TASK_WORDING.filter((entry) =>
      RECORDED_DECISIONS.cutTasks.includes(entry.task),
    );
    const matches = cut.flatMap((entry) =>
      scanPhrases(COPY_MODULES, entry.phrases),
    );
    expect(matches, describePhraseMatches(matches)).toEqual([]);
  });

  it("finds no real-sealing promise on a no-go", () => {
    if (RECORDED_DECISIONS.realSealing !== "no-go") {
      return;
    }
    const matches = scanPhrases(COPY_MODULES, REAL_SEALING_WORDING);
    expect(matches, describePhraseMatches(matches)).toEqual([]);
  });

  it("holds real-sealing wording only as listed for the owner while the decision is open", () => {
    if (RECORDED_DECISIONS.realSealing !== "undecided") {
      return;
    }
    const found = scanPhrases(COPY_MODULES, REAL_SEALING_WORDING).map(
      (m) => `${relative(ROOT, m.file)}|${m.phrase}`,
    );
    const unlisted = found.filter((entry) => !HELD_FOR_OWNER.includes(entry));
    expect(
      unlisted,
      `New real-sealing wording for owner review:\n${unlisted.join("\n")}`,
    ).toEqual([]);
  });
});
