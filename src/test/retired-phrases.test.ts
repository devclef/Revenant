import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import Home from "@/app/page";
import { Footer } from "@/components/ui/Footer";
import { pageMetadata } from "@/lib/page-metadata";

import { lineOf, readSourceFiles, type SourceFile } from "./source-scan";
import { textOutsideUserContent } from "./user-content";

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
  {
    name: "the old seal instruction \"Press and hold the seal to break it, or use the button below.\"",
    pattern: /press and hold the seal to break it, or use the button below\./i,
  },
];

/**
 * Words the UI avoids (F1.3, F6.3). The design adds them to the copy modules
 * only, so they are checked in copy.ts files and in content/personas.
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

function isCopyModule(path: string): boolean {
  return /(^|\/)copy\.ts$/.test(path) || path.startsWith("content/personas/");
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
      .flatMap((file) => findMatches(file.path, file.text, AVOIDED_WORDS));
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

  it("names the file and the line of each hit", () => {
    const text = "Opening line\n\nThe word caught appears on line three.";
    expect(findMatches("src/example/copy.ts", text, AVOIDED_WORDS)).toEqual([
      'src/example/copy.ts:3 "caught"',
    ]);
  });
});
