// Feature: 07-judge-journey (spec 07 task 4)
//
// Property 10 extended to recall and marks (design.md Property 10). The Ghost's
// horizontal placement, its classes and every horizontal style value are the
// same in intact, recall, marks and seal, in both layouts. Only the pose (the
// vertical lift, and the narrow scale on the pit) differs.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LocalViewProvider } from "../local-view";
import { MotionProvider } from "../motion";
import { SkipProvider } from "../skip";
import { StageContext } from "../stage-context";
import type { Stage } from "../stages";
import { ghostHanded } from "../stages";
import { PersonaGhost } from "./PersonaGhost";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "scene.module.css"), "utf8");

const PLACED_STAGES: Stage[] = ["intact", "recall", "marks", "seal"];

function ghostAt(stage: Stage): string {
  return renderToStaticMarkup(
    createElement(
      MotionProvider,
      null,
      createElement(
        SkipProvider,
        null,
        createElement(
          LocalViewProvider,
          null,
          createElement(StageContext.Provider, { value: stage }, createElement(PersonaGhost)),
        ),
      ),
    ),
  );
}

/** The markup with only the pose attribute removed, so placement is compared alone. */
// The pose and the compact flag (spec 09 P4.2) select CSS rules; the placement is the same.
const withoutPose = (html: string) =>
  html.replace(/ data-pose="(?:risen|handed)"/g, "").replace(/ data-compact="(?:true|false)"/g, "");

describe("Property 10: the Ghost's horizontal placement is the same in every placed Stage", () => {
  it("renders identical classes, styles and horizontal values in intact, recall, marks and seal", () => {
    const [first, ...rest] = PLACED_STAGES.map((stage) => withoutPose(ghostAt(stage)));
    for (const html of rest) {
      expect(html).toBe(first);
    }
  });

  it("changes only the pose attribute between intact and recall", () => {
    const risen = ghostAt("intact");
    const handed = ghostAt("recall");
    expect(risen).toContain('data-pose="risen"');
    expect(handed).toContain('data-pose="handed"');
    expect(withoutPose(risen)).toBe(withoutPose(handed));
  });

  it("hands the Ghost from recall through seal, and keeps it risen in intact", () => {
    expect(ghostHanded("intact")).toBe(false);
    expect(ghostHanded("recall")).toBe(true);
    expect(ghostHanded("marks")).toBe(true);
    expect(ghostHanded("seal")).toBe(true);
  });

  it("keeps the handed rules to vertical lift and the narrow scale, never a sideways move", () => {
    const handedRule = css.match(/\.ghost\[data-pose="handed"\] \{([^}]*)\}/)?.[1] ?? "";
    expect(handedRule).not.toMatch(/left|translateX/);
    const narrowPit = css.match(/\.pit\[data-pose="handed"\] \{([^}]*)\}/)?.[1] ?? "";
    // The only horizontal value is the same -50 % centring the pit always has.
    expect(narrowPit).toContain("translateX(-50%) scale(0.8)");
    expect(narrowPit).not.toMatch(/left/);
  });

  it("keeps the placement rules out of the pose selectors in both layouts", () => {
    for (const selector of ['.ghost[data-pose="handed"]', '.pit[data-pose="handed"]']) {
      const body = css.match(new RegExp(`${selector.replace(/[[\]"()]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";
      expect(body).not.toMatch(/\bleft:/);
    }
  });
});
