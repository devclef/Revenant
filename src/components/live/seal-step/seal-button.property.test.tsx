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

const RUNS = { numRuns: 200 };

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
