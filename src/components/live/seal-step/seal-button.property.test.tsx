// Feature: 20-easier-sealing-and-receipts (Part C), Property 3.
//
// For any label, blocked state and status-line id, the Seal_Button is a native
// button that is never disabled, points at the status line, reports its
// blocked state with aria-disabled, and carries no pointer handlers.
// fast-check runs each property at least 100 times.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { SealButton } from "./SealButton";
import { sealButtonLabel } from "./seal-button";
import { pressStatusLine, type PressStatusTag } from "./press-status";
import { PRESS_COPY } from "../press/copy";

const RUNS = { numRuns: 200 };

const TAGS: readonly PressStatusTag[] = [
  "write",
  "creating",
  "created",
  "confirming",
  "preparing",
  "sealing",
];

const labelArb = fc.stringMatching(/^[A-Za-z][A-Za-z ]{0,30}[A-Za-z]$/);
const lineIdArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,20}$/);

describe("Property 3: the Seal_Button is a native button with aria-disabled and no pointer handlers", () => {
  it("renders a type=button with the label, the status-line reference and aria-disabled for any input", () => {
    fc.assert(
      fc.property(
        labelArb,
        fc.boolean(),
        lineIdArb,
        (label, blocked, lineId) => {
          const html = renderToStaticMarkup(
            createElement(SealButton, {
              label,
              blocked,
              lineId,
              onActivate: () => undefined,
            }),
          );
          expect(html).toMatch(/^<button[^>]*>/);
          expect(html).toContain('type="button"');
          expect(html).toContain("data-seal-button");
          expect(html).toContain(`aria-describedby="${lineId}"`);
          expect(html).toContain(
            `aria-disabled="${blocked ? "true" : "false"}"`,
          );
          expect(html).toContain(`>${label}</button>`);
        },
      ),
      RUNS,
    );
  });

  it("never renders the disabled attribute, so a blocked press stays focusable", () => {
    fc.assert(
      fc.property(
        labelArb,
        fc.boolean(),
        lineIdArb,
        (label, blocked, lineId) => {
          const html = renderToStaticMarkup(
            createElement(SealButton, {
              label,
              blocked,
              lineId,
              onActivate: () => undefined,
            }),
          );
          expect(html).not.toMatch(/\sdisabled(=|\s|>)/);
        },
      ),
      RUNS,
    );
  });

  it("keeps the pointer handlers off the element, for any input", () => {
    fc.assert(
      fc.property(
        labelArb,
        fc.boolean(),
        lineIdArb,
        (label, blocked, lineId) => {
          const element = SealButton({
            label,
            blocked,
            lineId,
            onActivate: () => undefined,
          });
          const props = element.props as Record<string, unknown>;
          expect(props).not.toHaveProperty("onPointerDown");
          expect(props).not.toHaveProperty("onPointerUp");
          expect(props).not.toHaveProperty("onMouseDown");
          expect(typeof props.onClick).toBe("function");
        },
      ),
      RUNS,
    );
  });
});

// Property 3, simulated flag (spec 20, Part B, Requirements 1.9, 11.7). The
// Seal_Button label follows the Seal_State and the Simulated_Mode flag. A false
// flag gives the passkey label, and a true flag gives the simulated label only
// in write and creating.
describe("Property 3: the Seal_Button label follows the Seal_State and the simulated flag", () => {
  it("gives the passkey label with simulated false and no flag, and the simulated label in write and creating when true", () => {
    fc.assert(
      fc.property(fc.constantFrom(...TAGS), fc.boolean(), (tag, simulated) => {
        const label = sealButtonLabel(tag, simulated);
        expect(label.length).toBeGreaterThan(0);
        if (simulated && (tag === "write" || tag === "creating")) {
          expect(label).toBe(PRESS_COPY.sealButtonCreateSimulated);
        } else if (tag === "write" || tag === "creating") {
          expect(label).toBe(PRESS_COPY.sealButtonCreate);
        } else {
          expect(label).toBe(PRESS_COPY.sealButtonSet);
        }
        if (!simulated) {
          expect(label).toBe(sealButtonLabel(tag));
        }
      }),
      RUNS,
    );
  });

  it("keeps the Seal_Button label in created, confirming, preparing and sealing with simulated true", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<PressStatusTag>("created", "confirming", "preparing", "sealing"),
        (tag) => {
          expect(sealButtonLabel(tag, true)).toBe(PRESS_COPY.sealButtonSet);
        },
      ),
      RUNS,
    );
  });

  it("gives the same Press_Status_Line with simulated false as with no flag", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TAGS),
        fc.constantFrom<"card" | "skip" | null>("card", "skip", null),
        fc.constantFrom<"full" | "reduced" | "calm">("full", "reduced", "calm"),
        (tag, backupChoice, motion) => {
          expect(
            pressStatusLine({ tag, backupChoice, motion, simulated: false }),
          ).toEqual(pressStatusLine({ tag, backupChoice, motion }));
        },
      ),
      RUNS,
    );
  });
});
