import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import Home from "@/app/page";
import { Footer } from "@/components/ui/Footer";
import { pageMetadata } from "@/lib/page-metadata";

import { lineOf, readSourceFiles, type SourceFile } from "./source-scan";
import { textOutsideUserContent } from "./user-content";
import {
  RETIRED_WORD,
  userStringsOfJson,
  userStringsOfText,
  userStringsOfTs,
  type UserString,
} from "./user-strings";

// page.tsx imports feature-flags.ts, which imports `server-only`.
vi.mock("server-only", () => ({}));

/**
 * Framing guard (spec 09, F8.1 and F8.2, design.md "F. Framing"). Retired
 * phrases must not return in user-facing copy: the source, the rendered `/`
 * and the page metadata. The time capsule may appear as an example; it is
 * flagged only where a sentence says Revenant resurrects, revives or brings it
 * back.
 */

interface RetiredPhrase {
  name: string;
  pattern: RegExp;
}

const RETIRED_PHRASES: readonly RetiredPhrase[] = [
  {
    name: "the retired tagline",
    pattern: /your past self returns with the receipts/i,
  },
  { name: "\"rose-tinted\"", pattern: /rose[- ]tinted/i },
  {
    name: "a time capsule named as what Revenant resurrects or revives",
    pattern:
      /\b(resurrect\w*|revive\w*|brings?\s+back|bring\w*\s+back)\b[^.!?]{0,60}\btime[- ]capsules?\b/i,
  },
  {
    name: "a time capsule that is resurrected, revived or brought back",
    pattern: /time[- ]capsule[^.!?]{0,40}\b(is|was)\s+(resurrected|revived|brought back)/i,
  },
  {
    name: "the removed persona opening event \"U.S. presidential election day\"",
    pattern: /U\.S\. presidential election day/i,
  },
  {
    name: "the removed persona opening event \"European Parliament election\"",
    pattern: /European Parliament election/i,
  },
  { name: "\"Pick up the letter\"", pattern: /pick up the letter/i },
  // Issue #339 (X3): the generic failed-request line retired this phrase. The
  // now row says only that no newer figure could be reached.
  {
    name: "\"Check your connection and reload the page\"",
    pattern: /check your connection and reload the page/i,
  },
  {
    name: "the old seal instruction \"Press and hold the seal to break it, or use the button below.\"",
    pattern: /press and hold the seal to break it, or use the button below\./i,
  },
  // Brand_Copy H2 (#353): the four-step ritual no longer has a "Seal the figures" step.
  { name: "\"Seal the figures\" as a step name", pattern: /seal the figures/i },
  // Brand_Copy H2 (#353): a letter holds any part of life, not fuel prices from the US or the EU.
  {
    name: "\"fuel prices from the US or the EU\" as what a letter holds",
    pattern: /fuel prices from the US or the EU/i,
  },
];

/**
 * Words the UI avoids (F1.3, F6.3). They are checked only in the values a
 * reader sees (see user-strings.ts), in the copy modules, in the occasion
 * starters and questions, in the persona files, and in the rendered `/` page
 * and its metadata.
 */
const AVOIDED_WORDS: readonly RetiredPhrase[] = [
  { name: "\"cross-examine\"", pattern: /cross-examine/i },
  { name: "\"caught\"", pattern: /\bcaught\b/i },
  { name: "\"misremember\"", pattern: /misremember/i },
];

const SOURCE_ROOTS = ["src", "content/personas"];
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".json", ".txt", ".md"];

/**
 * Copy-test records (content/personas/letters/*-copy-test.md) quote the
 * phrases the copy checks look for, so they are excluded from the scan.
 */
const COPY_TEST_RECORD = /^content\/personas\/letters\/[^/]+-copy-test\.md$/;

/** The files the phrase scans read: every source file except copy-test records. */
function scannedSourceFiles(files: readonly SourceFile[]): SourceFile[] {
  return files.filter((file) => !COPY_TEST_RECORD.test(file.path));
}

/** Files whose string values are user copy and are checked for AVOIDED_WORDS. */
function isCopyModule(path: string): boolean {
  return (
    /(^|\/)copy\.ts$/.test(path) ||
    path === "src/components/live/occasions.ts" ||
    path.startsWith("content/personas/")
  );
}

/** The string values a reader sees in one file, read by its type. */
function userStringsOf(file: SourceFile): UserString[] {
  if (/\.tsx?$/.test(file.path)) return userStringsOfTs(file.path, file.text);
  if (file.path.endsWith(".json")) return userStringsOfJson(file.path, file.text);
  return userStringsOfText(file.path, file.text);
}

/**
 * Hits for `phrases` in string values only. Each hit names the file, the line
 * and the value it was found in.
 */
function findValueMatches(
  strings: readonly UserString[],
  phrases: readonly RetiredPhrase[],
): string[] {
  const hits: string[] = [];
  for (const entry of strings) {
    for (const { name, pattern } of phrases) {
      const flags = pattern.flags.replace("g", "");
      if (new RegExp(pattern.source, flags).test(entry.value)) {
        hits.push(
          `${entry.file}:${entry.line} ${name} in ${JSON.stringify(entry.value)}`,
        );
      }
    }
  }
  return hits;
}

/** Every match in `text`, as "file:line name" for a failure message. */
function findMatches(
  path: string,
  text: string,
  phrases: readonly RetiredPhrase[],
): string[] {
  const hits: string[] = [];
  for (const { name, pattern } of phrases) {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    const global = new RegExp(pattern.source, flags);
    for (const match of text.matchAll(global)) {
      hits.push(`${path}:${lineOf(text, match.index ?? 0)} ${name}`);
    }
  }
  return hits;
}

/**
 * Text of the rendered `/` page and the footer the root layout adds to it.
 * One text node per line, so a hit reports its line in this text. User
 * content is left out by textOutsideUserContent.
 */
function renderedLandingText(): string {
  const html =
    renderToStaticMarkup(createElement(Home)) +
    renderToStaticMarkup(createElement(Footer));
  return textOutsideUserContent(html)
    .map((node) => node.replace(/\s+/g, " ").trim())
    .filter((node) => node.length > 0)
    .join("\n");
}

describe("F8.1 retired phrases in source", () => {
  const files = scannedSourceFiles(
    readSourceFiles(SOURCE_ROOTS, SOURCE_EXTENSIONS),
  );

  it("scans a non-empty set of source files", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("no Retired_Phrase in any non-test source file under src/ or content/personas/", () => {
    const hits = files.flatMap((file) =>
      findMatches(file.path, file.text, RETIRED_PHRASES),
    );
    expect(hits).toEqual([]);
  });

  it("no word the UI avoids in the copy modules", () => {
    const hits = files
      .filter((file) => isCopyModule(file.path))
      .flatMap((file) =>
        findValueMatches(userStringsOf(file), AVOIDED_WORDS),
      );
    expect(hits).toEqual([]);
  });
});

describe("F8.2 classroom time capsule", () => {
  it("allows the time capsule as an example", () => {
    expect(
      RETIRED_PHRASES[2].pattern.test(
        "A classroom time capsule works the same way.",
      ),
    ).toBe(false);
  });

  it("flags a time capsule that Revenant resurrects", () => {
    expect(
      RETIRED_PHRASES[2].pattern.test("Revenant resurrects the time capsule."),
    ).toBe(true);
    expect(
      RETIRED_PHRASES[3].pattern.test("The time capsule was brought back."),
    ).toBe(true);
  });
});

describe("F8.4 retired phrases in the rendered / output and page metadata", () => {
  it("no Retired_Phrase in the rendered / page and footer", () => {
    const text = renderedLandingText();
    expect(text.length).toBeGreaterThan(0);
    expect(findMatches("rendered /", text, RETIRED_PHRASES)).toEqual([]);
  });

  it("no Retired_Phrase in the landing page metadata", () => {
    const meta = JSON.stringify(pageMetadata(null, "/"));
    expect(findMatches("page metadata", meta, RETIRED_PHRASES)).toEqual([]);
  });

  it("no word the UI avoids in the rendered / page and footer", () => {
    const text = renderedLandingText();
    expect(
      findValueMatches(userStringsOfText("rendered /", text), AVOIDED_WORDS),
    ).toEqual([]);
  });

  it("no word the UI avoids in the landing page metadata values", () => {
    const meta = JSON.stringify(pageMetadata(null, "/"));
    expect(
      findValueMatches(userStringsOfJson("page metadata", meta), AVOIDED_WORDS),
    ).toEqual([]);
  });
});

describe("copy-test exclusion and hit reporting", () => {
  it("drops copy-test records from the content/personas scan and keeps the letters", () => {
    const personas = readSourceFiles(["content/personas"], SOURCE_EXTENSIONS);
    const paths = personas.map((file) => file.path);
    expect(paths).toContain("content/personas/letters/us-copy-test.md");

    const scanned = scannedSourceFiles(personas).map((file) => file.path);
    expect(scanned).not.toContain("content/personas/letters/us-copy-test.md");
    expect(scanned).toContain("content/personas/letters/us-maya.txt");
  });

  it("lets a retired phrase in a real copy-test record pass the scan", () => {
    const personas = readSourceFiles(["content/personas"], SOURCE_EXTENSIONS);
    const record = personas.find(
      (file) => file.path === "content/personas/letters/us-copy-test.md",
    );
    expect(record).toBeDefined();
    const path = "content/personas/letters/us-copy-test.md";
    const planted = `${record?.text ?? ""}\nrose-tinted\n`;

    // The phrase is really there, so the record would fail without the exclusion.
    // The record already quotes the election phrases, so its own hits are
    // expected too. The exact list is the record's hits plus the planted line.
    const recordHits = findMatches(path, record?.text ?? "", RETIRED_PHRASES);
    expect(findMatches(path, planted, RETIRED_PHRASES)).toEqual([
      `${path}:${lineOf(planted, planted.indexOf("rose-tinted"))} "rose-tinted"`,
      ...recordHits,
    ]);

    const scanned = scannedSourceFiles([{ path, text: planted }]);
    expect(scanned).toEqual([]);
  });

  it("fails a retired phrase in the real us-maya.txt and names its file and line", () => {
    const path = "content/personas/letters/us-maya.txt";
    const letter = readSourceFiles(["content/personas"], SOURCE_EXTENSIONS).find(
      (file) => file.path === path,
    );
    expect(letter).toBeDefined();
    const lines = (letter?.text ?? "").split("\n");
    // Plant the phrase as line 3 of the real letter, in memory only.
    lines.splice(2, 0, "rose-tinted");
    const planted = lines.join("\n");

    const hits = scannedSourceFiles([{ path, text: planted }]).flatMap(
      (file) => findMatches(file.path, file.text, RETIRED_PHRASES),
    );
    expect(hits).toEqual([`${path}:3 "rose-tinted"`]);
  });

  it("names the file, the line and the value of each hit", () => {
    const source = [
      'const first = "Opening line";',
      "",
      'export const second = "The word caught appears on line three.";',
    ].join("\n");
    expect(
      findValueMatches(
        userStringsOfTs("src/example/copy.ts", source),
        AVOIDED_WORDS,
      ),
    ).toEqual([
      'src/example/copy.ts:3 "caught" in "The word caught appears on line three."',
    ]);
  });
});

describe("L4.2 the retired Live_Prefill question", () => {
  it("is no longer in RETIRED_PHRASES: \"right now\" is allowed in Occasion questions (spec 15, R8.2)", () => {
    expect(RETIRED_PHRASES.some((p) => /right now/i.test(p.name))).toBe(false);
  });
});

/**
 * Spec 16, Requirement 4: "testif" and "testimon" must leave user copy. Until
 * tasks 3, 10 and 13 of that spec change their strings, each hit on `main` is
 * listed here with the task that removes it. A task removes its entries in
 * the same commit. The list is empty once task 13 has landed.
 */
interface PendingRetiredWord {
  path: string;
  value: string;
  task: 3 | 10 | 13;
}

const PENDING_RETIRED_WORDS: readonly PendingRetiredWord[] = [
  // src/components/ceremony/copy.ts.
  {
    path: "src/components/ceremony/copy.ts",
    value: "Your testimony is recorded.",
    task: 10,
  },
  // src/components/landing/copy.ts, removed by task 13 (short home section).
  {
    path: "src/components/landing/copy.ts",
    value:
      "A seal proves the letter wasn't changed. It can't stop your memory changing. So before you read, you testify, and Revenant never says what the gap means.",
    task: 13,
  },
  // src/components/reveal/copy.ts.
  { path: "src/components/reveal/copy.ts", value: "Testify", task: 3 },
  {
    path: "src/components/reveal/copy.ts",
    value:
      "This letter was written as of {date}. Before you read it, testify: say what you remember about that time.",
    task: 3,
  },
  // The rendered / page, which repeats the copy above.
  {
    path: "rendered /",
    value:
      "A seal proves the letter wasn't changed. It can't stop your memory changing. So before you read, you testify, and Revenant never says what the gap means.",
    task: 13,
  },
];

/** One line per hit, for a failure message: "file:line \"value\"". */
function formatUserString(entry: UserString): string {
  return `${entry.file}:${entry.line} ${JSON.stringify(entry.value)}`;
}

/** The values a reader sees in the copy modules, the persona files and the rendered / page. */
function userCopyStrings(
  files: readonly SourceFile[],
): UserString[] {
  const fromFiles = files
    .filter((file) => isCopyModule(file.path))
    .flatMap((file) => userStringsOf(file));
  const landing = userStringsOfText("rendered /", renderedLandingText());
  const meta = userStringsOfJson(
    "page metadata",
    JSON.stringify(pageMetadata(null, "/")),
  );
  return [...fromFiles, ...landing, ...meta];
}

/** Values that hit RETIRED_WORD, in source order. */
function retiredWordHits(strings: readonly UserString[]): UserString[] {
  return strings.filter((entry) => RETIRED_WORD.test(entry.value));
}

describe("F4 retired words in user copy (spec 16, Requirement 4)", () => {
  const files = scannedSourceFiles(
    readSourceFiles(SOURCE_ROOTS, SOURCE_EXTENSIONS),
  );
  const hits = retiredWordHits(userCopyStrings(files));

  it("no retired word in user copy outside the pending list", () => {
    const unlisted = hits
      .filter(
        (hit) =>
          !PENDING_RETIRED_WORDS.some(
            (pending) =>
              pending.path === hit.file && pending.value === hit.value,
          ),
      )
      .map(formatUserString);
    expect(unlisted).toEqual([]);
  });

  it("every pending entry still hits user copy", () => {
    const stale = PENDING_RETIRED_WORDS.filter(
      (pending) =>
        !hits.some(
          (hit) => hit.file === pending.path && hit.value === pending.value,
        ),
    ).map((pending) => JSON.stringify(pending));
    expect(stale).toEqual([]);
  });
});

describe("F4.5 retired-word fixtures", () => {
  it("passes a key testimonyRecorded whose value is \"What you remembered is recorded.\"", () => {
    const source =
      'export const copy = { testimonyRecorded: "What you remembered is recorded." };';
    const found = retiredWordHits(
      userStringsOfTs("src/example/copy.ts", source),
    );
    expect(found.map(formatUserString)).toEqual([]);
  });

  it("fails a value containing \"Testimony\" and names the file, line and value", () => {
    const source = [
      "const first = 1;",
      'export const copy = { heading: "Your Testimony" };',
    ].join("\n");
    const found = retiredWordHits(
      userStringsOfTs("src/example/copy.ts", source),
    );
    expect(found.map(formatUserString)).toEqual([
      'src/example/copy.ts:2 "Your Testimony"',
    ]);
  });

  it("fails a value containing \"testified\" and names the file, line and value", () => {
    const source = [
      'export const first = "Opening line";',
      "",
      'export const second = "She testified to it.";',
    ].join("\n");
    const found = retiredWordHits(
      userStringsOfTs("src/example/copy.ts", source),
    );
    expect(found.map(formatUserString)).toEqual([
      'src/example/copy.ts:3 "She testified to it."',
    ]);
  });
});

/**
 * Property 10 (spec 16, Requirements 2.8 and 4.1 to 4.4): the retired-word scan
 * reads values, not names. The cases are a fixed table rather than generated
 * inputs, so every run checks the same fixtures. Each case says whether the
 * scan must flag it.
 */
describe("Property 10: The retired-word scan reads values, not names", () => {
  const cases: ReadonlyArray<{
    name: string;
    kind: "ts" | "json";
    source: string;
    flagged: boolean;
  }> = [
    {
      name: "a key containing a retired word passes when its value is clean",
      kind: "ts",
      source:
        'export const copy = { testimonyRecorded: "What you remembered is recorded." };',
      flagged: false,
    },
    {
      name: "an identifier containing a retired word passes when its value is clean",
      kind: "ts",
      source: 'const testifyLater = "Say what you remember.";',
      flagged: false,
    },
    {
      name: "an import path containing a retired word passes",
      kind: "ts",
      source: 'import { helpers } from "./testimony-helpers";',
      flagged: false,
    },
    {
      name: "a comparison operand containing a retired word passes",
      kind: "ts",
      source: 'if (kind === "testify") { run(); }',
      flagged: false,
    },
    {
      name: "a JSON key containing a retired word passes when its value is clean",
      kind: "json",
      source: '{ "testimonyNote": "Say what you remember." }',
      flagged: false,
    },
    {
      name: "a string value containing a retired word fails",
      kind: "ts",
      source: 'export const copy = { heading: "Your testimony" };',
      flagged: true,
    },
    {
      name: "a template value containing a retired word fails",
      kind: "ts",
      source: "export const copy = { line: `Testify first` };",
      flagged: true,
    },
    {
      name: "a JSON value containing a retired word fails",
      kind: "json",
      source: '{ "note": "She testified to it." }',
      flagged: true,
    },
  ];

  for (const testCase of cases) {
    it(`${testCase.name}`, () => {
      const strings =
        testCase.kind === "json"
          ? userStringsOfJson("src/example/copy.json", testCase.source)
          : userStringsOfTs("src/example/copy.ts", testCase.source);
      const found = retiredWordHits(strings);
      expect(found.length > 0).toBe(testCase.flagged);
    });
  }
});
