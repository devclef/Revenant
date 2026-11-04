// Feature: 07-judge-journey, R21.5 to R21.7
//
// The image and texture files a Scene route loads total at most 150 kB, and at
// most 40 kB before first paint (R21.5, R21.6, spec 05 R13.5). No Scene image
// or texture goes through a data: or blob: URL (R21.7). The Scene draws its
// texture with CSS gradients and inline SVG or canvas (ASSETS.md), so this test
// reads the Scene source and fails when a file reference or a data: or blob:
// URL appears in it.
//
// Test files are skipped, so the scan reads only the shipped code.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

/** Image and texture budgets in bytes (R21.5, R21.6). */
const SCENE_TOTAL_BYTES = 150 * 1024;
const FIRST_PAINT_BYTES = 40 * 1024;

/** File types that count as an image or texture. Fonts are counted in spec 05 R13.4, not here. */
const IMAGE_OR_TEXTURE = /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)$/i;

function sceneSources(): { name: string; text: string }[] {
  return readdirSync(here)
    .filter((name) => /\.(css|ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name))
    .map((name) => ({ name, text: readFileSync(join(here, name), "utf8") }));
}

describe("R21.5 to R21.7: the Scene loads no image or texture file over budget", () => {
  it("has no image or texture file in the Scene folder, so the budgets hold at zero", () => {
    const files = readdirSync(here).filter((name) => IMAGE_OR_TEXTURE.test(name));
    const bytes = files.reduce((sum, name) => sum + statSync(join(here, name)).size, 0);
    expect(files, "Scene folder holds image or texture files (R21.5)").toEqual([]);
    expect(bytes).toBeLessThanOrEqual(SCENE_TOTAL_BYTES);
    expect(bytes).toBeLessThanOrEqual(FIRST_PAINT_BYTES);
  });

  it("references no image or texture file from Scene CSS through url()", () => {
    for (const { name, text } of sceneSources().filter((s) => s.name.endsWith(".css"))) {
      for (const m of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
        const target = m[1];
        // A url(#id) points at an SVG element in the same document, not a file.
        if (target.startsWith("#")) continue;
        expect(target, `${name} loads ${target} through url() (R21.5)`).not.toMatch(IMAGE_OR_TEXTURE);
      }
    }
  });

  it("uses no data: or blob: URL in Scene source (R21.7)", () => {
    for (const { name, text } of sceneSources()) {
      const found = text.match(/["'(`]\s*(data|blob):/);
      expect(found, `${name} uses a ${found?.[1]}: URL (R21.7)`).toBeNull();
    }
  });

  it("has no <img> element in Scene components, so no file is loaded through src (R21.5)", () => {
    for (const { name, text } of sceneSources().filter((s) => s.name.endsWith(".tsx"))) {
      expect(text, `${name} renders an <img> (R21.5)`).not.toMatch(/<img\b/);
    }
  });
});
