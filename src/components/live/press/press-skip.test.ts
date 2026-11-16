// Feature: 13-the-seal
//
// Tests for the press Skip (spec 13, design section 2, P2.6). Skip moves the
// running animation to its final frame and never calls, awaits or answers a
// passkey prompt. The node environment cannot run effects, so the registration
// rule is tested as a pure function and the source is scanned for passkey use.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import { registerPressSkip } from "./press-skip";

function fakeRegistrar() {
  const registered: Array<() => void> = [];
  const unregister = vi.fn();
  return {
    registered,
    unregister,
    registrar: {
      register: (skip: () => void) => {
        registered.push(skip);
        return unregister;
      },
    },
  };
}

describe("registerPressSkip (P2.6)", () => {
  it("registers nothing when no Skip context wraps the press", () => {
    expect(registerPressSkip(null, true, () => undefined)).toBeUndefined();
  });

  it("registers nothing while the animation is not running", () => {
    const { registered, registrar } = fakeRegistrar();
    expect(
      registerPressSkip(registrar, false, () => undefined),
    ).toBeUndefined();
    expect(registered).toHaveLength(0);
  });

  it("registers one skip while the animation runs and returns unregister", () => {
    const { registered, registrar, unregister } = fakeRegistrar();
    const stop = registerPressSkip(registrar, true, () => undefined);
    expect(registered).toHaveLength(1);
    expect(stop).toBe(unregister);
  });

  it("calls only the caller's onSkip when skip runs, once per call", () => {
    const { registered, registrar } = fakeRegistrar();
    const onSkip = vi.fn();
    registerPressSkip(registrar, true, onSkip);
    registered[0]();
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("never calls a passkey function on skip", () => {
    const credentials = {
      create: vi.fn(),
      get: vi.fn(),
    };
    vi.stubGlobal("navigator", { credentials });
    try {
      const { registered, registrar } = fakeRegistrar();
      const onCreatePress = vi.fn();
      const onConfirmPress = vi.fn();
      registerPressSkip(registrar, true, () => undefined);
      registered[0]();
      expect(credentials.create).not.toHaveBeenCalled();
      expect(credentials.get).not.toHaveBeenCalled();
      expect(onCreatePress).not.toHaveBeenCalled();
      expect(onConfirmPress).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("press-skip.ts source (P2.6)", () => {
  it("names no passkey, credential or press starter in code", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./press-skip.ts", import.meta.url)),
      "utf8",
    )
      // Comments may explain the rule; only code is scanned.
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(source).not.toMatch(/passkey|credentials|createPasskey|getPasskey/i);
    expect(source).not.toMatch(/onCreatePress|onConfirmPress/);
  });
});
