// Feature: 07-judge-journey, spec 07 task 6 (figures and the close)
//
// Skip reaches the final state of stage 3 (R15.1, R14.9): the figures are
// settled, every figure is at full opacity and the Close mounts. The renders
// here are static (renderToStaticMarkup), so these tests check the pieces that
// make the final state reachable on a real page:
//
//   1. FiguresFadeUp registers with Skip only while the figures are running,
//      and its finish cancels the fades before it settles;
//   2. the figures column has no retired then/now rules left in the stylesheet.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const here = __dirname;
const css = readFileSync(resolve(here, "figures.module.css"), "utf8");
const fadeSource = readFileSync(resolve(here, "FiguresFadeUp.tsx"), "utf8");

describe("stage 3 Skip target", () => {
  it("finish cancels every fade and then settles the figures", () => {
    expect(fadeSource).toMatch(
      /const finish = useCallback\(\(\) => \{\s*if \(finished\.current\) return;[\s\S]*?animation\.cancel\(\);[\s\S]*?setLocalView\(\{ figures: "settled" \}\);\s*\}, \[setLocalView\]\);/,
    );
  });

  it("registers finish with the shared Skip only while the figures run", () => {
    expect(fadeSource).toMatch(
      /if \(localView\.figures !== "running"\) return undefined;\s*return register\(finish\);/,
    );
  });

  it("the clock's end also calls finish, so Skip and the natural end agree", () => {
    expect(fadeSource).toContain("clock.onfinish = finish;");
  });
});

describe("stage 3 final state for the figures", () => {
  it("no retired then/now rules remain in the figures stylesheet", () => {
    expect(css).not.toMatch(/data-step=/);
    expect(css).not.toMatch(/\.passage|\.counter|\.stamp|\.sequence/);
  });
});
