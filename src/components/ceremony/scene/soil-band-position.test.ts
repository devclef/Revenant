// Feature: 14-seal-polish (spec 14 B2, issue #480)
//
// The Soil_Band stays out from behind text. The band moves to the bottom of the
// Scene on tall pages (the backdrop is one window tall and absolute to the
// Scene root), and the Scene content reserves `--soil-clear` at its bottom so
// the last text ends above the band. These tests read the CSS and the component
// sources directly. Pure file read, no DOM.
//
// The soil colour and edge blocks must stay byte-identical to main. The
// expected text below is copied from origin/main, comments stripped, so any
// change to the band's look shows up here.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(resolve(here, name), "utf8");

const css = read("scene.module.css").replace(/\/\*[\s\S]*?\*\//g, "");
const tokens = read("tokens.css");

/**
 * The exact text of the first top-level rule whose selector line is `selector {`,
 * from the selector through its closing brace. Comments are stripped first, as
 * the expected strings were captured.
 */
function ruleText(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(
    new RegExp(`(?:^|\\n)${escaped} \\{[\\s\\S]*?\\n\\}`),
  );
  if (match === null) throw new Error(`no rule for ${selector}`);
  return match[0].replace(/^\n/, "");
}

const MAIN_SOIL_LAYER = `.soilLayer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}`;

const MAIN_SOIL_LAYER_CANVAS = `.soilLayer > canvas {
  position: absolute;
  left: 0;
  top: 0;
  display: block;
}`;

const MAIN_SOIL_STRIP = `.soilStrip {
  position: absolute;
  left: 0;
  right: 0;
  top: var(--soil-top);
  height: var(--soil-band);
  clip-path: polygon(
    0% 100%,
    0% min(7%, 12px),
    6% min(3%, 12px),
    11% min(9%, 12px),
    17% min(4%, 12px),
    24% min(10%, 12px),
    31% min(2%, 12px),
    38% min(8%, 12px),
    45% min(5%, 12px),
    52% min(11%, 12px),
    59% min(3%, 12px),
    66% min(9%, 12px),
    73% min(4%, 12px),
    80% min(10%, 12px),
    87% min(2%, 12px),
    93% min(7%, 12px),
    100% min(5%, 12px),
    100% 100%
  );
  background:
    radial-gradient(ellipse 30% 90% at var(--ghost-x) 0%, var(--soil-lit), transparent),
    radial-gradient(var(--clod) 1px, transparent 1.5px) 0 0 / 14px 14px,
    linear-gradient(to bottom, var(--soil-mid), var(--soil-deep));
}`;

const MAIN_SOIL_STRIP_AFTER = `.soilStrip::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 25%;
  background: linear-gradient(to bottom, transparent, var(--bg));
}`;

/** The soil colour tokens, as they appear in tokens.css on main. */
const MAIN_SOIL_TOKENS = [
  "  --soil-deep: #0d0a10;",
  "  --soil-mid: #211829;",
  "  --soil-lit: #b080ff;",
  "  --clod: #2a1f33;",
];

describe("the soil colour and edge are byte-identical to main (B2)", () => {
  it("keeps the Soil_Layer rule", () => {
    expect(ruleText(".soilLayer")).toBe(MAIN_SOIL_LAYER);
  });

  it("keeps the Soil_Layer canvas rule", () => {
    expect(ruleText(".soilLayer > canvas")).toBe(MAIN_SOIL_LAYER_CANVAS);
  });

  it("keeps the Soil_Fallback strip rule, including the jagged edge and the gradient", () => {
    expect(ruleText(".soilStrip")).toBe(MAIN_SOIL_STRIP);
  });

  it("keeps the Soil_Fallback fade rule", () => {
    expect(ruleText(".soilStrip::after")).toBe(MAIN_SOIL_STRIP_AFTER);
  });

  it("keeps the soil colour tokens", () => {
    for (const line of MAIN_SOIL_TOKENS) {
      expect(tokens.split("\n")).toContain(line);
    }
  });
});

describe("the Soil_Band sits at the bottom of the Scene on tall pages (B2.2)", () => {
  it("makes the backdrop absolute to the Scene root, one window tall, at the bottom", () => {
    const backdrop = ruleText(".backdrop");
    expect(backdrop).toMatch(/position: absolute;/);
    expect(backdrop).toMatch(/bottom: 0;/);
    expect(backdrop).toMatch(/height: 100vh;/);
    expect(backdrop).not.toMatch(/position: fixed;/);
  });

  it("keeps the Scene as the containing block for the backdrop", () => {
    expect(ruleText(".scene")).toMatch(/position: relative;/);
  });
});

describe("--soil-clear reserves the Soil_Band at the Scene bottom (B2.1)", () => {
  it("defines --soil-clear as the drawn band height plus 16 px, on the Scene", () => {
    expect(ruleText(".scene")).toContain(
      "--soil-clear: calc(var(--soil-band) + 16px);",
    );
  });

  it("applies --soil-clear as the bottom padding of the page content", () => {
    expect(ruleText(".main")).toContain("padding-bottom: var(--soil-clear);");
  });

  it("uses the same drawn height as the strip, so the reserve tracks the band", () => {
    expect(MAIN_SOIL_STRIP).toContain("height: var(--soil-band);");
    expect(ruleText(".scene")).toContain("--soil-band:");
  });
});

describe("aria-hidden is kept on the Soil_Band and the canvas", () => {
  const backdropSrc = read("SceneBackdrop.tsx");
  const soilCanvasSrc = read("soil-canvas.ts");
  const soilStripSrc = read("SoilStrip.tsx");

  it("renders the backdrop, which holds the Soil_Fallback strip and the canvas layer, as aria-hidden", () => {
    const backdropOpen = backdropSrc.indexOf("className={styles.backdrop}");
    expect(backdropOpen).toBeGreaterThan(-1);
    const block = backdropSrc.slice(
      backdropOpen,
      backdropSrc.indexOf("</div>", backdropOpen),
    );
    expect(block).toContain('aria-hidden="true"');
    expect(block).toContain("<SoilStrip />");
    expect(block).toContain("<SoilCanvasLoader />");
  });

  it("marks the Soil_Canvas element aria-hidden when it mounts", () => {
    expect(soilCanvasSrc).toContain(
      'canvas.setAttribute("aria-hidden", "true");',
    );
  });

  it("keeps SoilStrip free of text and interaction, so it has nothing to announce", () => {
    expect(soilStripSrc).not.toMatch(/role=/);
    expect(soilStripSrc).not.toMatch(/onClick|tabIndex/);
  });
});
