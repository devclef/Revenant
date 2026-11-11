import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { UnlockInfo } from "@/components/reveal/opening-machine";
import { LIVE_COPY } from "./copy";
import { LiveLetter } from "./LiveLetter";
import { UnlockView } from "./UnlockView";
import type { UnlockControls } from "./unlock";

/**
 * Static markup for the Letter_Page key handling (spec 06 task 12, R21.6).
 * `renderToStaticMarkup` runs no effects, so the server render of LiveLetter
 * shows no flow. The key is read and stripped only in the mount effect. The
 * pre-filled key field is checked through UnlockView with a keyText value.
 */

describe("LiveLetter server render", () => {
  it("renders nothing before the mount effect reads the fragment", () => {
    const markup = renderToStaticMarkup(createElement(LiveLetter, { letterId: "Q1JLWmJqQ3BkMzhWaHh4eA" }));
    expect(markup).toBe("");
  });

  // L4.5 (spec 11): /l/[id] for a Real_Letter never shows the Rehearsal_Line.
  // The server render is empty, so this pins the absence; the source scan in
  // rehearsal-line.property.test.ts checks the markup the client renders.
  it("never shows the rehearsal line", () => {
    const markup = renderToStaticMarkup(createElement(LiveLetter, { letterId: "Q1JLWmJqQ3BkMzhWaHh4eA" }));
    expect(markup).not.toContain("data-live-rehearsal");
    expect(markup).not.toContain(LIVE_COPY.rehearsalLine);
  });
});

describe("UnlockView pre-filled key", () => {
  const unlock: UnlockInfo = { passkey: null, backup: true } as UnlockInfo;
  const controls: UnlockControls = { ready: true, passkey: vi.fn(), backup: vi.fn() };

  it("shows the key text in the key field and does not submit", () => {
    const keyText = "3ABCDEFGHJKMNPQRSTVWXYZ012A";
    const markup = renderToStaticMarkup(
      createElement(UnlockView, {
        unlock,
        notice: null,
        controls,
        keyText,
        onKeyTextChange: vi.fn(),
      }),
    );
    expect(markup).toContain(`value="${keyText}"`);
    expect(controls.backup).not.toHaveBeenCalled();
  });
});
