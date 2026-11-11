// Feature: 10-own-questions (spec 10 C6.3, C6)
//
// The marks layer is a sibling of the aria-hidden Ghost layer, so the Seal_Group
// controls stay in the accessibility tree. The Idle_Bob holds still in `marks`
// and `seal`. The repo runs in the node environment, so the markup comes from
// renderToStaticMarkup and the stylesheet is read as text.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./../motion", () => ({
  useMotion: () => ({ mode: "full", setCalm: vi.fn() }),
  MotionProvider: ({ children }: { children: unknown }) => children,
}));

import { SceneBackdrop } from "./SceneBackdrop";

const css = readFileSync(join(__dirname, "scene.module.css"), "utf8");

describe("marks layer (spec 10 C6.3)", () => {
  it("renders the marks layer as a sibling of the aria-hidden Ghost layer", () => {
    const html = renderToStaticMarkup(
      createElement(
        SceneBackdrop,
        { marksLayerRef: () => undefined },
        createElement("span", { "data-test-ghost": "" }),
      ),
    );
    const ghostAt = html.indexOf("data-ghost-layer");
    const marksAt = html.indexOf("data-marks-layer");
    expect(ghostAt).toBeGreaterThan(-1);
    expect(marksAt).toBeGreaterThan(ghostAt);

    // The marks layer's own tag is not aria-hidden, and it is not inside the
    // Ghost layer's tag: the Ghost layer closes before the marks layer opens.
    const marksTag = html.slice(html.lastIndexOf("<div", marksAt), html.indexOf(">", marksAt) + 1);
    expect(marksTag).not.toContain("aria-hidden");
    const ghostTag = html.slice(html.lastIndexOf("<div", ghostAt), html.indexOf(">", ghostAt) + 1);
    expect(ghostTag).toContain('aria-hidden="true"');
    const ghostClose = html.indexOf('data-test-ghost=""');
    expect(html.indexOf("</div>", ghostClose)).toBeLessThan(marksAt);
  });

  it("draws no marks layer when no ref is given", () => {
    const html = renderToStaticMarkup(createElement(SceneBackdrop, {}));
    expect(html).not.toContain("data-marks-layer");
  });

  it("keeps the Ghost's Idle_Bob still while data-ceremony is marks or seal", () => {
    expect(css).toMatch(
      /\.scene:has\(:is\(\[data-ceremony="marks"\],\s*\[data-ceremony="seal"\]\)\)\s+\.bob\s*\{\s*animation:\s*none;\s*\}/,
    );
  });

  it("keeps the marks layer's own stacking under the Top_Bar and above the Ghost", () => {
    const layer = css.match(/\n\.marksLayer \{([^}]*)\}/)?.[1] ?? "";
    expect(layer).toMatch(/z-index:\s*2;/);
    expect(layer).toMatch(/pointer-events:\s*none;/);
  });

  it("portals the Seal_Group into the marks layer, and the HeldSeal stays in the Ghost", () => {
    const sealSource = readFileSync(join(__dirname, "..", "seal", "SealBreak.tsx"), "utf8");
    expect(sealSource).toMatch(/marksSlot,\s*\)/);
    const heldSource = readFileSync(join(__dirname, "..", "seal", "HeldSeal.tsx"), "utf8");
    expect(heldSource).toMatch(/aria-hidden="true"/);
    expect(heldSource).not.toMatch(/tabIndex=\{?0/);
  });
});
