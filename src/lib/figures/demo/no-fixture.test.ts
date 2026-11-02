// No-fixture checks for the demo figures (spec 04-real-figures, Task 9).
//
// DEMO_FIGURES is the real figure file only. These tests keep it that way:
// the set holds no fixture data, every persona's then and now figures are real,
// and no persona file or demo page names a fixture metric. No network, no
// database.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { PERSONAS } from "@/lib/personas";

import { CATALOGUE } from "../catalogue";
import { isFixtureFigure } from "../fixture";
import { thenAndNow } from "../then-now";

import { DEMO_FIGURES } from ".";

const ROOT = resolve(process.cwd());
const SRC_ROOT = join(ROOT, "src");
// A quoted module path ending in the fixture file name, as used in import,
// require or dynamic import.
const IMPORT_OF_FIXTURE = /["'`][^"'`\n]*us-fuel\.fixture\.json["'`]/;

// Recursively list every file under a directory. Skips node_modules and build
// output, which hold no Revenant source.
function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      out.push(...listFiles(path));
    } else {
      out.push(path);
    }
  }
  return out;
}

function isTestFile(path: string): boolean {
  return /\.test\.[cm]?[jt]sx?$/.test(path);
}

describe("DEMO_FIGURES is real data only (R9.8)", () => {
  it("is not marked as fixture", () => {
    expect(DEMO_FIGURES.fixture).toBe(false);
  });

  it("holds exactly the four catalogue series, each with figures", () => {
    const catalogueIds = CATALOGUE.map((s) => s.metric.id).sort();
    const demoIds = [...DEMO_FIGURES.series.keys()].sort();
    expect(demoIds).toEqual(catalogueIds);
    expect(demoIds).toHaveLength(4);

    for (const [id, series] of DEMO_FIGURES.series) {
      expect(series.figures.length, `${id} has figures`).toBeGreaterThan(0);
    }
  });

  it("marks no figure in DEMO_FIGURES as a fixture figure", () => {
    for (const [id, series] of DEMO_FIGURES.series) {
      for (const figure of series.figures) {
        expect(isFixtureFigure(figure), `${id} ${figure.period}`).toBe(false);
      }
    }
  });
});

describe("persona then and now figures are real (R11.1)", () => {
  it("has at least one persona to check", () => {
    expect(PERSONAS.length).toBeGreaterThan(0);
  });

  for (const persona of PERSONAS) {
    for (const metric of persona.metrics) {
      it(`${persona.letter_id} / ${metric.metric_id}: then and now are found and not fixture`, () => {
        const { then, now } = thenAndNow(
          metric.metric_id,
          persona.written_as_of,
          DEMO_FIGURES,
        );

        expect(then.found, "then figure is found").toBe(true);
        expect(now.found, "now figure is found").toBe(true);
        if (then.found) expect(isFixtureFigure(then.figure)).toBe(false);
        if (now.found) expect(isFixtureFigure(now.figure)).toBe(false);
      });
    }
  }
});

describe("no fixture metric IDs in persona content or demo pages (R11.3)", () => {
  const scanRoots = [
    join(ROOT, "content", "personas"),
    join(SRC_ROOT, "app", "demo"),
  ];

  it("scans at least one file under each root", () => {
    for (const root of scanRoots) {
      expect(listFiles(root).length, root).toBeGreaterThan(0);
    }
  });

  it("names no metric ID starting with fixture-", () => {
    const offenders: string[] = [];
    for (const root of scanRoots) {
      for (const file of listFiles(root)) {
        const text = readFileSync(file, "utf8");
        if (/["'`]fixture-/.test(text)) {
          offenders.push(relative(ROOT, file));
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("the fixture JSON is not imported outside tests (R9.8, R9.11)", () => {
  it("no non-test source file imports us-fuel.fixture.json", () => {
    const offenders: string[] = [];
    for (const file of listFiles(SRC_ROOT)) {
      if (isTestFile(file)) continue;
      if (!/\.[cm]?[jt]sx?$/.test(file)) continue;
      const text = readFileSync(file, "utf8");
      // Match a quoted module specifier, so a comment that names the file is
      // not counted as an import.
      if (IMPORT_OF_FIXTURE.test(text)) {
        offenders.push(relative(ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
