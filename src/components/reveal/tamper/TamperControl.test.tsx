// Feature: 13-the-seal (spec A1, A2.7, A4; task 2 of issue #427)
//
// Markup and source-scan tests for the Tamper_Control. Rendered with
// `renderToStaticMarkup` and `createElement`, with no DOM library and no JSX,
// matching the other reveal tests. The press itself needs a browser run, so the
// pressed states are covered by the layout check and the Live_Walk; here the
// closed control, the copy rules and the forbidden-API scan are checked.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TamperControl } from "./TamperControl";
import { TAMPER_COPY } from "./tamper-copy";

const ROOT = process.cwd();

function read(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8");
}

describe("TamperControl closed markup (A1.1, A1.4, A4.1)", () => {
  const html = renderToStaticMarkup(
    createElement(TamperControl, { getSource: () => null }),
  );

  it("renders a native button labelled 'Try to tamper with it' (A1.1)", () => {
    expect(html).toContain("<button");
    expect(html).toContain(`>${TAMPER_COPY.button}</button>`);
    // A native button is keyboard reachable without a tabindex.
    expect(html).not.toContain('tabindex="-1"');
  });

  it("states beside the control that the stored letter is not changed (A1.4)", () => {
    expect(html).toContain(TAMPER_COPY.note);
    expect(html).toContain('id="tamper-note"');
    expect(html).toContain('aria-describedby="tamper-note"');
  });

  it("shows no result region until the control is pressed", () => {
    expect(html).not.toContain("data-tamper-result");
    expect(html).not.toContain("The seal is cracked");
  });
});

describe("tamper copy follows tone.md and neutrality.md (A4.1, A4.2)", () => {
  const values = Object.values(TAMPER_COPY) as string[];

  it("has no exclamation mark", () => {
    for (const value of values) expect(value).not.toContain("!");
  });

  it("never uses a grading or attack word", () => {
    const banned = [
      /\bcaught\b/i,
      /\bwrong\b/i,
      /\bhacked\b/i,
      /\battack\b/i,
      /failed to break/i,
      /congratulat/i,
      /\bscore\b/i,
    ];
    for (const value of values) {
      for (const pattern of banned) {
        expect(value, `"${value}" must not match ${pattern}`).not.toMatch(
          pattern,
        );
      }
    }
  });
});

describe("tamper modules make no request and write nothing (A2.7)", () => {
  // The same forbidden names as the Q2.5 scan in design.md, for the two files
  // that hold the Tamper_Control's logic and its view.
  const FORBIDDEN = [
    "fetch(",
    "XMLHttpRequest",
    "sendBeacon",
    "localStorage",
    "sessionStorage",
    "indexedDB",
    "document.cookie",
    "history.",
    "location.",
    "setTimeout",
    "setInterval",
    "Math.random",
    "POST /api/openings",
  ];

  for (const file of [
    "src/components/reveal/tamper/tamper-run.ts",
    "src/components/reveal/tamper/TamperControl.tsx",
  ]) {
    it(`${file} contains no forbidden request, storage or timer name`, () => {
      const source = read(file);
      for (const name of FORBIDDEN) {
        expect(source, `${file} must not contain ${name}`).not.toContain(name);
      }
    });
  }

  it("calls the real check through the dynamic crypto import, not a copy of it", () => {
    const run = read("src/components/reveal/tamper/tamper-run.ts");
    expect(run).toContain('import("@/lib/crypto/open")');
    expect(run.match(/openLetter\(/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
  });
});
