import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { ALL_CHECKS, evaluateLiveStep } from "../../tools/qa/journey-check.mjs";

/**
 * Regression guard for tools/qa/journey-check.mjs (issue #401). The persona
 * page now opens straight on the recall Stage (spec 10 C1), so the journey
 * check's persona steps must wait for `recall` and must not look for the
 * removed intact Stage or the removed "Pick up the letter" button.
 */

const source = readFileSync(resolve(__dirname, "../../tools/qa/journey-check.mjs"), "utf8");

/** Returns the source of a top-level `async function name(...) { ... }`, with comments removed. */
function functionBody(name: string): string {
  const start = source.indexOf(`async function ${name}(`);
  if (start < 0) throw new Error(`function ${name} not found in journey-check.mjs`);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        return source
          .slice(start, i + 1)
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/(^|[^:])\/\/.*$/gm, "$1");
      }
    }
  }
  throw new Error(`function ${name} has no closing brace`);
}

describe("journey-check persona steps", () => {
  it("waitForFirstStage waits for the recall Stage", () => {
    const body = functionBody("waitForFirstStage");
    expect(body).toContain('"recall"');
    expect(body).not.toMatch(/intact/i);
    expect(body).not.toMatch(/Pick up the letter/);
  });

  it("personaReveal starts at the recall Stage", () => {
    const body = functionBody("personaReveal");
    expect(body).toContain("waitForFirstStage");
    expect(body).toContain('atStage("recall")');
    expect(body).not.toMatch(/intact/i);
    expect(body).not.toMatch(/Pick up the letter/);
  });

  it("the file no longer refers to the intact Stage outside comments", () => {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(code).not.toMatch(/data-ceremony=intact|"intact"|'intact'/);
    expect(code).not.toMatch(/Pick up the letter/);
  });
});

describe("journey-check J9 (spec 12 Q1.8): evaluateLiveStep", () => {
  const clean = { expected: "write", step: "write", scrollWidth: 390, clientWidth: 390, motionCount: 1, consoleErrors: [] };

  it("passes a step on the expected screen with no sideways scroll, one Motion_Control and no console error", () => {
    const r = evaluateLiveStep(clean);
    expect(r.status).toBe("pass");
    expect(r.measured).toContain('step="write"');
    expect(r.measured).toContain("consoleErrors=0");
  });

  it("fails when the document scrolls sideways", () => {
    const r = evaluateLiveStep({ ...clean, scrollWidth: 412 });
    expect(r.status).toBe("fail");
    expect(r.measured).toContain("scrollWidth 412px > clientWidth 390px");
  });

  it("passes when scrollWidth equals clientWidth", () => {
    expect(evaluateLiveStep({ ...clean, scrollWidth: 1440, clientWidth: 1440 }).status).toBe("pass");
  });

  it.each([0, 2])("fails when the Motion_Control count is %i, not 1", (motionCount) => {
    const r = evaluateLiveStep({ ...clean, motionCount });
    expect(r.status).toBe("fail");
    expect(r.measured).toContain(`Motion_Control count ${motionCount}, need 1`);
  });

  it("fails on any console error and names the first one", () => {
    const r = evaluateLiveStep({ ...clean, consoleErrors: ["Refused to load script\nat line 3", "second"] });
    expect(r.status).toBe("fail");
    expect(r.measured).toContain("2 console error(s), first: Refused to load script");
    expect(r.measured).not.toContain("second");
  });

  it("fails when the page is not on the expected step", () => {
    const r = evaluateLiveStep({ ...clean, expected: "seal", step: "write" });
    expect(r.status).toBe("fail");
    expect(r.measured).toContain('reached step "write", need "seal"');
  });

  it("fails when no step attribute is on the page", () => {
    const r = evaluateLiveStep({ ...clean, step: null });
    expect(r.status).toBe("fail");
    expect(r.measured).toContain('reached step "none"');
  });

  it("the seal step passes with the same rules as the Write step", () => {
    expect(evaluateLiveStep({ ...clean, expected: "seal", step: "seal" }).status).toBe("pass");
  });

  it("J9 is one of the checks run by default", () => {
    expect(ALL_CHECKS).toContain("J9");
  });
});
