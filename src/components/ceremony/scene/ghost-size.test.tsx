// Feature: 09-demo-polish (spec 09 P4.2). The optional size prop on the Ghost.
//
// The default (no prop) must render the same markup as the full size, so the
// existing callers are unaffected. The compact size may change only the
// data-size attribute on the pit: no class, style, svg or text may differ.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GHOST_SIZE_COMPACT, GHOST_SIZE_FULL } from "../constants";
import { Ghost, type GhostProps } from "./Ghost";

const render = (props?: GhostProps) =>
  renderToStaticMarkup(createElement(Ghost, props));

describe("the Ghost size prop (default)", () => {
  it("renders the same markup with no prop as with the full size", () => {
    expect(render()).toBe(render({ size: GHOST_SIZE_FULL }));
  });

  it("marks the pit as the full size when no prop is given", () => {
    expect(render()).toContain(`data-size="${GHOST_SIZE_FULL}"`);
    expect(render()).not.toContain(`data-size="${GHOST_SIZE_COMPACT}"`);
  });
});

describe("the Ghost size prop (what it changes)", () => {
  it("changes only the data-size attribute between full and compact", () => {
    const full = render({ size: GHOST_SIZE_FULL });
    const compact = render({ size: GHOST_SIZE_COMPACT });
    expect(compact).not.toBe(full);
    expect(
      compact.replace(
        `data-size="${GHOST_SIZE_COMPACT}"`,
        `data-size="${GHOST_SIZE_FULL}"`,
      ),
    ).toBe(full);
  });

  it("leaves the drawing, eyes and classes the same at the compact size", () => {
    const compact = render({ size: GHOST_SIZE_COMPACT });
    expect(compact.match(/<svg[^>]*>/)?.[0]).toBe(
      render().match(/<svg[^>]*>/)?.[0],
    );
    expect(compact.match(/class="[^"]*"/g)).toEqual(
      render().match(/class="[^"]*"/g),
    );
  });
});
