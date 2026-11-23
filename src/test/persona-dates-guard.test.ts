import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  formatCalendarDate,
  formatCalendarMonth,
  formatShortDate,
} from "../components/ui/letter-date";

/**
 * Date_Guard (spec 18, Requirement 12). Fails when a Persona_Dates value of
 * the Persona_List is written anywhere else in the repository, in any of its
 * five Date_Forms. The Persona_Dates are read from content/personas/personas.json
 * at test time, so this file holds no date literal at all.
 */

/** The repository root, found from this file (src/test/ is two levels down). */
export const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));

/** The Persona_List, read as text. Its dates are the only source of forms. */
export const PERSONA_LIST_PATH = "content/personas/personas.json";

/** The fuel Figure_File. Its `period` and `retrieved_at` values may hold a form (Requirement 12.8). */
export const FIGURE_FILE = "src/lib/figures/real/fuel-figures.json";

/** Roots scanned, relative to the repository root. */
export const SCAN_ROOTS = [
  "src",
  "tools",
  "scripts",
  ".github",
  "content",
  "README.md",
  "docs/video-script.md",
];

/**
 * Directories skipped at any depth of the scanned roots. Names with no slash
 * match a folder name anywhere. Entries with a slash match a path from the
 * repository root.
 */
export const SKIP_DIRS = [
  "node_modules",
  ".next",
  "dist",
  ".git",
  ".kiro/specs",
  "docs/design",
];

/**
 * Files that may hold a Persona_Dates Date_Form. The Persona_List and the three
 * letters and their copy-test records are the places a date is allowed to live.
 * The two further entries are named in design.md ("Date_Guard", per-file
 * actions): the layout-check baseline is regenerated from the rendered page, and
 * the spec 12 evidence record keeps a dated note as written.
 */
export const EXEMPT_FILES = [
  "content/personas/personas.json",
  "content/personas/letters/us-maya.txt",
  "content/personas/letters/eu-tomas.txt",
  "content/personas/letters/us-priya.txt",
  "content/personas/letters/us-copy-test.md",
  "content/personas/letters/eu-copy-test.md",
  "content/personas/letters/us-priya-copy-test.md",
  "tools/qa/layout-gate-baseline.json",
  "tools/qa/patches/spec-12-tasks.evidence.md",
];

/** The five ways one Persona_Dates value can be written. */
export type DateFormKind = "iso" | "instant" | "day" | "short" | "month";

export interface DateForm {
  kind: DateFormKind;
  text: string;
}

export interface Finding {
  /** Path relative to the repository root, with forward slashes. */
  path: string;
  /** 1-based line number. */
  line: number;
  /** The Date_Form text that matched. */
  form: string;
}

const DAY_PREFIX = /^\d{4}-\d{2}-\d{2}/;

/**
 * The five Date_Forms of one Persona_Dates value, built with the formatters the
 * UI uses (src/components/ui/letter-date.ts). The value may be a plain date or
 * an ISO instant at midnight UTC; only its day is used.
 */
export function dateFormsOf(value: string): DateForm[] {
  const match = DAY_PREFIX.exec(value);
  if (!match) {
    throw new Error(`Date_Guard: ${PERSONA_LIST_PATH} holds a value that is not a date: "${value}"`);
  }
  const day = match[0];
  const instant = `${day}T00:00:00.000Z`;
  const forms: DateForm[] = [
    { kind: "iso", text: day },
    { kind: "instant", text: instant },
    { kind: "day", text: formatCalendarDate(day) },
    { kind: "short", text: formatShortDate(instant) },
    { kind: "month", text: formatCalendarMonth(day) },
  ];
  for (const form of forms) {
    if (form.text === "") {
      throw new Error(`Date_Guard: a formatter returned no text for "${value}"`);
    }
  }
  return forms;
}

/** Keeps one form per text, so a date repeated by several personas counts once. */
function uniqueForms(forms: readonly DateForm[]): DateForm[] {
  const seen = new Map<string, DateForm>();
  for (const form of forms) {
    if (!seen.has(form.text)) seen.set(form.text, form);
  }
  return [...seen.values()];
}

/**
 * The Persona_Dates values (`written_as_of` and `opens_at`) of a parsed
 * Persona_List. Fails with a message naming the Persona_List when it yields none,
 * so the guard never passes with zero forms checked (Requirement 12.9).
 */
export function personaDatesFrom(parsed: unknown): string[] {
  const personas =
    parsed !== null && typeof parsed === "object"
      ? (parsed as { personas?: unknown }).personas
      : undefined;
  const dates: string[] = [];
  if (Array.isArray(personas)) {
    for (const persona of personas) {
      if (persona === null || typeof persona !== "object") continue;
      for (const field of ["written_as_of", "opens_at"]) {
        const value = (persona as Record<string, unknown>)[field];
        if (typeof value === "string") dates.push(value);
      }
    }
  }
  if (dates.length === 0) {
    throw new Error(`Date_Guard: ${PERSONA_LIST_PATH} (the Persona_List) yielded no persona dates`);
  }
  return [...new Set(dates)];
}

function readPersonaDates(): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(`${REPO_ROOT}/${PERSONA_LIST_PATH}`, "utf8"));
  } catch (error) {
    throw new Error(
      `Date_Guard: ${PERSONA_LIST_PATH} (the Persona_List) cannot be read or parsed: ${String(error)}`,
    );
  }
  return personaDatesFrom(parsed);
}

function isSkippedDir(relPath: string, name: string): boolean {
  return SKIP_DIRS.some((entry) =>
    entry.includes("/") ? relPath === entry || relPath.startsWith(`${entry}/`) : name === entry,
  );
}

/** Every file under the scan roots, as repository-relative paths. */
function listScannedFiles(): string[] {
  const out: string[] = [];
  const walk = (relPath: string): void => {
    const abs = `${REPO_ROOT}/${relPath}`;
    if (statSync(abs).isFile()) {
      out.push(relPath);
      return;
    }
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const childRel = `${relPath}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!isSkippedDir(childRel, entry.name)) walk(childRel);
      } else if (entry.isFile()) {
        out.push(childRel);
      }
    }
  };
  for (const root of SCAN_ROOTS) walk(root);
  return out.sort();
}

/** The text of a file, or null for a binary file (one that holds a NUL byte). */
function readText(relPath: string): string | null {
  const buffer = readFileSync(`${REPO_ROOT}/${relPath}`);
  if (buffer.includes(0)) return null;
  return buffer.toString("utf8");
}

const FIGURE_FIELD = /"(period|retrieved_at)"\s*:\s*"([^"]*)"/g;

/**
 * Empties a Figure_File `period` or `retrieved_at` value that holds a form. The
 * same form anywhere else on the line still counts.
 */
function exemptFigureFields(line: string, forms: readonly DateForm[]): string {
  return line.replace(FIGURE_FIELD, (whole, field: string, value: string) =>
    forms.some((form) => value.includes(form.text)) ? `"${field}": ""` : whole,
  );
}

/**
 * The forms found on one line. A month form does not count when the text before
 * it ends with one or two digits and a space, so a day date is reported once,
 * by its day form. A match that lies inside a longer match on the same
 * line (the ISO date inside the ISO instant) is dropped.
 */
function formsOnLine(line: string, forms: readonly DateForm[]): DateForm[] {
  const found: { start: number; end: number; form: DateForm }[] = [];
  for (const form of forms) {
    let from = 0;
    for (;;) {
      const index = line.indexOf(form.text, from);
      if (index === -1) break;
      from = index + 1;
      if (form.kind === "month" && /\d{1,2}[ \u00a0]$/.test(line.slice(0, index))) continue;
      found.push({ start: index, end: index + form.text.length, form });
    }
  }
  return found
    .filter(
      (match) =>
        !found.some(
          (other) =>
            other !== match &&
            other.start <= match.start &&
            other.end >= match.end &&
            other.end - other.start > match.end - match.start,
        ),
    )
    .sort((a, b) => a.start - b.start)
    .map((match) => match.form);
}

/**
 * Every Date_Form in `text` at each 1-based line. An exempt path reports
 * nothing.
 */
export function scanText(path: string, text: string, forms: readonly DateForm[]): Finding[] {
  if (EXEMPT_FILES.includes(path)) return [];
  const findings: Finding[] = [];
  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = path === FIGURE_FILE ? exemptFigureFields(rawLine, forms) : rawLine;
    for (const form of formsOnLine(line, forms)) {
      findings.push({ path, line: index + 1, form: form.text });
    }
  });
  return findings;
}

/** Scans every file under SCAN_ROOTS and returns every finding. */
export function scanRepository(forms: readonly DateForm[]): Finding[] {
  const findings: Finding[] = [];
  for (const path of listScannedFiles()) {
    const text = readText(path);
    if (text === null) continue;
    findings.push(...scanText(path, text, forms));
  }
  return findings;
}

const PERSONA_FORMS = uniqueForms(readPersonaDates().flatMap((value) => dateFormsOf(value)));

describe("Date_Guard", () => {
  it("builds five Date_Forms for each Persona_Dates value read from the Persona_List", () => {
    const distinctDays = new Set(
      readPersonaDates().map((value) => value.slice(0, 10)),
    );
    expect(PERSONA_FORMS).toHaveLength(5 * distinctDays.size);
  });

  it("fails with a message naming the Persona_List when it yields zero dates", () => {
    expect(() => personaDatesFrom({ personas: [] })).toThrow(/Persona_List/);
    expect(() => personaDatesFrom({})).toThrow(/Persona_List/);
  });

  it("reports a planted day form and a planted month form at the right line", () => {
    const day = PERSONA_FORMS.find((form) => form.kind === "day");
    const month = PERSONA_FORMS.find((form) => form.kind === "month");
    if (!day || !month) throw new Error("Date_Guard: no day or month form to plant");
    const text = `first line\nsaid ${day.text}\nsaid ${month.text}`;
    expect(scanText("src/example.ts", text, PERSONA_FORMS)).toEqual([
      { path: "src/example.ts", line: 2, form: day.text },
      { path: "src/example.ts", line: 3, form: month.text },
    ]);
  });

  it("does not report a month form that is part of a day date", () => {
    const day = PERSONA_FORMS.find((form) => form.kind === "day");
    const month = PERSONA_FORMS.find((form) => form.kind === "month");
    if (!day || !month) throw new Error("Date_Guard: no day or month form to plant");
    // The day date contains the month form, but it is preceded by a day number
    // and a space, so only the day form is reported.
    expect(day.text).toContain(month.text);
    expect(scanText("src/example.ts", `said ${day.text}`, PERSONA_FORMS)).toEqual([
      { path: "src/example.ts", line: 1, form: day.text },
    ]);
  });

  it("reports every Persona_Dates Date_Form outside the Persona_List in one run", () => {
    const hits = scanRepository(PERSONA_FORMS);
    if (hits.length > 0) {
      const lines = hits.map((hit) => `${hit.path}:${hit.line}: "${hit.form}"`);
      throw new Error(
        `Date_Guard: Persona_Dates Date_Forms found outside the Persona_List:\n${lines.join("\n")}`,
      );
    }
    expect(hits).toEqual([]);
  });
});
