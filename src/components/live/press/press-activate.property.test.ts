// Feature: 20-easier-sealing-and-receipts (Part C), Property 1.
//
// One passkey prompt per press, whether the press comes from the wax (a held
// pointer release) or from the Seal_Button (activate, or a keyboard click). A
// press that is blocked starts no prompt. fast-check runs each property at
// least 100 times. No DOM, no network.

import { describe, expect, it, vi } from "vitest";
import fc from "fast-check";

import { SEAL_PRESS_HOLD_MS } from "./constants";
import { createPressController, type PressConfig } from "./usePressEnvelope";

const RUNS = { numRuns: 200 };

type PressKind = "activate" | "click" | "held";

const kindArb = fc.constantFrom<PressKind>("activate", "click", "held");

/** A recording controller: every prompt and every blocked attempt is counted. */
function recorder(init: {
  disabled: boolean;
  mode?: PressConfig["mode"];
  instant?: boolean;
}) {
  const config: PressConfig = {
    mode: init.mode ?? "write",
    disabled: init.disabled,
    instant: init.instant ?? false,
    onCreatePress: vi.fn(),
    onConfirmPress: vi.fn(),
    onAttempt: vi.fn(),
  };
  const controller = createPressController(
    () => config,
    () => undefined,
  );
  const prompts = () =>
    (config.onCreatePress as ReturnType<typeof vi.fn>).mock.calls.length +
    (config.onConfirmPress as ReturnType<typeof vi.fn>).mock.calls.length;
  return { config, controller, prompts };
}

/** Runs one press of the given kind, starting at `t`. Returns the next free time. */
function press(
  controller: ReturnType<typeof createPressController>,
  kind: PressKind,
  t: number,
): number {
  if (kind === "activate") {
    controller.activate();
    return t + 1;
  }
  if (kind === "click") {
    controller.click(0);
    return t + 1;
  }
  // A held wax press: down, a frame at full hold, then the release.
  controller.down(t);
  controller.tick(t + SEAL_PRESS_HOLD_MS);
  controller.up(t + SEAL_PRESS_HOLD_MS);
  return t + SEAL_PRESS_HOLD_MS + 1;
}

describe("Property 1: one passkey prompt per press across Seal_Button and wax", () => {
  // Feature: 20-easier-sealing-and-receipts (Part C), Property 1: one prompt per press
  it("each enabled press, followed by a reset, starts exactly one prompt", () => {
    fc.assert(
      fc.property(
        fc.array(kindArb, { minLength: 1, maxLength: 20 }),
        (kinds) => {
          const { controller, prompts } = recorder({ disabled: false });
          let t = 0;
          for (const kind of kinds) {
            const before = prompts();
            t = press(controller, kind, t);
            expect(prompts() - before).toBe(1);
            controller.reset();
          }
        },
      ),
      RUNS,
    );
  });

  it("repeated presses with no reset between them start one prompt in total", () => {
    fc.assert(
      fc.property(
        fc.array(kindArb, { minLength: 2, maxLength: 20 }),
        (kinds) => {
          const { controller, prompts } = recorder({ disabled: false });
          let t = 0;
          for (const kind of kinds) t = press(controller, kind, t);
          expect(prompts()).toBe(1);
        },
      ),
      RUNS,
    );
  });

  it("a blocked press of either kind starts no prompt and reports the attempt", () => {
    fc.assert(
      fc.property(
        fc.array(kindArb, { minLength: 1, maxLength: 20 }),
        (kinds) => {
          const { config, controller, prompts } = recorder({ disabled: true });
          let t = 0;
          for (const kind of kinds) {
            t = press(controller, kind, t);
            controller.reset();
          }
          expect(prompts()).toBe(0);
          // Only the activation kinds reach onAttempt; a held release is a cancel.
          const activations = kinds.filter((k) => k !== "held").length;
          expect(
            (config.onAttempt as ReturnType<typeof vi.fn>).mock.calls.length,
          ).toBe(activations);
        },
      ),
      RUNS,
    );
  });

  it("the setting mode takes one activation as one confirm prompt, and no create prompt", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5 }), (n) => {
        const { config, controller } = recorder({
          disabled: false,
          mode: "setting",
        });
        for (let i = 0; i < n; i++) {
          controller.activate();
          controller.reset();
        }
        expect(
          (config.onConfirmPress as ReturnType<typeof vi.fn>).mock.calls.length,
        ).toBe(n);
        expect(
          (config.onCreatePress as ReturnType<typeof vi.fn>).mock.calls.length,
        ).toBe(0);
      }),
      RUNS,
    );
  });
});
