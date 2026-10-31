import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FlowError, type FlowErrorKind } from "./FlowError";
import { REVEAL_COPY } from "./copy";
import { DEMO_COPY } from "@/components/demo/copy";

/**
 * Markup tests for the error view (design.md Error Handling, R7.6-R7.9).
 * Rendered with `renderToStaticMarkup` and `createElement` — no DOM library and
 * no JSX.
 *
 * Every error kind must:
 * - render its own distinct copy string (no two kinds share a message);
 * - render NO sealed payload field (a failed or tampered open shows nothing
 *   from the letter, R7.6-R7.9, data-integrity.md);
 * - always offer the way back to the demo letters.
 *
 * Only the transient `unreachable` kind offers a retry control; every other
 * kind is terminal and shows the back link alone.
 */

const ALL_KINDS: FlowErrorKind[] = [
  "notPlaced",
  "unreachable",
  "verificationFailed",
  "wrongKey",
  "tampered",
  "unsupportedFormat",
  "invalidPayload",
  "invalidInput",
];

/** The copy each kind must render. */
const MESSAGE: Record<FlowErrorKind, string> = {
  notPlaced: REVEAL_COPY.notPlaced,
  unreachable: REVEAL_COPY.unreachable,
  verificationFailed: REVEAL_COPY.verificationFailed,
  wrongKey: REVEAL_COPY.wrongKey,
  tampered: REVEAL_COPY.tampered,
  unsupportedFormat: REVEAL_COPY.unsupportedFormat,
  invalidPayload: REVEAL_COPY.invalidPayload,
  invalidInput: REVEAL_COPY.invalidInput,
};

const NOOP = () => {};

/**
 * Escape a copy string the way React escapes text content in
 * `renderToStaticMarkup`, so an assertion on a string containing `'`, `"`, `&`,
 * `<` or `>` matches the serialised HTML (e.g. "hasn't" -> "hasn&#x27;t").
 */
function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function render(kind: FlowErrorKind): string {
  return renderToStaticMarkup(
    createElement(FlowError, { kind, onRetry: NOOP }),
  );
}

describe("FlowError markup", () => {
  it("renders its own distinct copy for each kind", () => {
    for (const kind of ALL_KINDS) {
      const html = render(kind);
      expect(html, `${kind} must show its message`).toContain(
        esc(MESSAGE[kind]),
      );
    }
  });

  it("gives every pair of kinds a distinct message (no shared copy)", () => {
    const seen = new Map<string, FlowErrorKind>();
    for (const kind of ALL_KINDS) {
      const message = MESSAGE[kind];
      expect(
        seen.has(message),
        `${kind} shares its message with ${seen.get(message)}`,
      ).toBe(false);
      seen.set(message, kind);
    }
  });

  it("always offers the way back to the demo letters", () => {
    for (const kind of ALL_KINDS) {
      const html = render(kind);
      expect(html).toContain(DEMO_COPY.backToDemo);
      expect(html).toContain('href="/demo"');
    }
  });

  it("offers a retry control only for the transient unreachable kind", () => {
    for (const kind of ALL_KINDS) {
      const html = render(kind);
      // The retry control is a <button>; the string "Try again" alone is not a
      // reliable signal, because some messages contain those words as prose.
      const hasRetryButton = html.includes("<button");
      if (kind === "unreachable") {
        expect(hasRetryButton, "unreachable must offer a retry button").toBe(
          true,
        );
        expect(html).toContain(REVEAL_COPY.retry);
      } else {
        expect(
          hasRetryButton,
          `${kind} is terminal and must render no retry button`,
        ).toBe(false);
      }
    }
  });

  it("renders no sealed payload field for any kind (R7.6-R7.9)", () => {
    // The component takes only { kind, onRetry }; it holds no Opened and so can
    // render no payload. This guards against a future prop leak.
    const forbidden = [
      "LETTER_BODY_SECRET",
      "3.412",
      "USD per gallon",
      "2024-10",
      "U.S. EIA",
      "serverSecret",
      "ciphertext",
      "nonce",
      "format_version",
    ];
    for (const kind of ALL_KINDS) {
      const html = render(kind);
      for (const needle of forbidden) {
        expect(
          html,
          `${kind} must not leak "${needle}"`,
        ).not.toContain(needle);
      }
    }
  });
});
