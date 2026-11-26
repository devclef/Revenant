// Feature: 20-easier-sealing-and-receipts (Part C).
//
// The Seal_Button's click must reach the press handler synchronously. The
// passkey API has to be called in the same task as the click, or the browser
// drops the user activation. These tests check that no await or timer sits
// between the click and the spies.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import {
  createPressController,
  type PressConfig,
} from "../press/usePressEnvelope";

const here = dirname(fileURLToPath(import.meta.url));

function controllerWith(init: Partial<PressConfig>) {
  const config: PressConfig = {
    mode: "write",
    disabled: false,
    instant: false,
    onCreatePress: vi.fn(),
    onConfirmPress: vi.fn(),
    onAttempt: vi.fn(),
    ...init,
  };
  const controller = createPressController(
    () => config,
    () => undefined,
  );
  return { config, controller };
}

describe("Seal_Button click reaches the press synchronously", () => {
  it("calls onCreatePress in the same tick as activate(), with no await", () => {
    const { config, controller } = controllerWith({ mode: "write" });
    controller.activate();
    // No microtask or timer has run yet: the spy must already hold the call.
    expect(config.onCreatePress).toHaveBeenCalledTimes(1);
    expect(config.onConfirmPress).not.toHaveBeenCalled();
  });

  it("calls onConfirmPress in the same tick in the setting mode", () => {
    const { config, controller } = controllerWith({ mode: "setting" });
    controller.activate();
    expect(config.onConfirmPress).toHaveBeenCalledTimes(1);
    expect(config.onCreatePress).not.toHaveBeenCalled();
  });

  it("calls onAttempt synchronously and starts no prompt while blocked", () => {
    const { config, controller } = controllerWith({ disabled: true });
    controller.activate();
    expect(config.onAttempt).toHaveBeenCalledTimes(1);
    expect(config.onCreatePress).not.toHaveBeenCalled();
    expect(config.onConfirmPress).not.toHaveBeenCalled();
  });

  it("the Seal_Button's onClick is the press activate, with no wrapper", () => {
    const source = readFileSync(join(here, "SealButton.tsx"), "utf8");
    expect(source).toMatch(/onClick=\{onActivate\}/);
    expect(source).not.toMatch(/\basync\b/);
    expect(source).not.toMatch(/\bawait\b/);
    expect(source).not.toMatch(
      /setTimeout|requestAnimationFrame|queueMicrotask/,
    );
  });

  it("the press hook passes activate through without a promise", () => {
    const source = readFileSync(
      join(here, "..", "press", "usePressEnvelope.ts"),
      "utf8",
    );
    const activate = /activate\(\) \{[\s\S]*?\n {4}\},/.exec(source)?.[0] ?? "";
    expect(activate).not.toBe("");
    expect(activate).not.toMatch(/\bawait\b|\basync\b|Promise|setTimeout/);
  });
});
