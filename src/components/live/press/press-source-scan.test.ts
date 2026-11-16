// Feature: 13-the-seal
//
// Source scan for the press (spec 13, tasks 2.4; requirements P5.2, Q2.7).
// The passkey prompt starts only from the release or the activation of the
// press. The press folder never creates a passkey, never starts a timer that
// could start one, and the Skip callback never reaches a passkey function.
// Only code is scanned: comments are stripped first, so the rule can be
// explained in comments.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PRESS_DIR = fileURLToPath(new URL(".", import.meta.url));

function codeOf(file: string): string {
  return readFileSync(`${PRESS_DIR}${file}`, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/([^:"'`])\/\/[^\n]*/g, "$1");
}

/** Every non-test source file in the press folder. */
function pressSourceFiles(): string[] {
  return readdirSync(PRESS_DIR).filter(
    (name) =>
      /\.(ts|tsx)$/.test(name) &&
      !/\.test\.(ts|tsx)$/.test(name) &&
      !/\.property\.test\.(ts|tsx)$/.test(name),
  );
}

describe("press source scan (P5.2, Q2.7)", () => {
  it("scans the press code files", () => {
    const files = pressSourceFiles();
    expect(files).toEqual(
      expect.arrayContaining([
        "PressEnvelope.tsx",
        "usePressEnvelope.ts",
        "press-hold.ts",
        "press-skip.ts",
      ]),
    );
  });

  it("the press folder never creates a passkey", () => {
    for (const file of pressSourceFiles()) {
      expect(codeOf(file), file).not.toMatch(/createPasskey|navigator\.credentials|credentials\.(create|get)/);
    }
  });

  it("no timer appears in the press code, so no timer callback can reach a passkey starter", () => {
    for (const file of pressSourceFiles()) {
      expect(codeOf(file), file).not.toMatch(/setTimeout|setInterval/);
    }
  });

  it("onCreatePress is called in one place only, the press effect, which the release and the activation reach", () => {
    const source = codeOf("usePressEnvelope.ts");
    const calls = source.match(/onCreatePress\(\)/g) ?? [];
    expect(calls).toHaveLength(1);

    // The one call sits inside `apply`, the function every release, click and
    // setting press goes through once the press model emits start_prompt.
    const applyStart = source.indexOf("function apply(");
    const fromSettingStart = source.indexOf("function fromSetting(");
    expect(applyStart).toBeGreaterThan(-1);
    expect(fromSettingStart).toBeGreaterThan(applyStart);
    const callAt = source.indexOf("onCreatePress()");
    expect(callAt).toBeGreaterThan(applyStart);
    expect(callAt).toBeLessThan(fromSettingStart);
  });

  it("onCreatePress and onConfirmPress are never called from the frame loop", () => {
    const source = codeOf("usePressEnvelope.ts");
    const loopStart = source.indexOf("const loop = () =>");
    expect(loopStart).toBeGreaterThan(-1);
    const loopBody = source.slice(loopStart, loopStart + 400);
    expect(loopBody).not.toMatch(/onCreatePress|onConfirmPress/);
  });

  it("the Skip callback never references a passkey function or a press starter", () => {
    const source = codeOf("press-skip.ts");
    expect(source).not.toMatch(/passkey|credentials|createPasskey|getPasskey/i);
    expect(source).not.toMatch(/onCreatePress|onConfirmPress/);
  });
});
