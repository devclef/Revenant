// Feature: 05-reveal-ceremony
//
// Tests for the decorative import gate (design.md "Desk", R13.3, R11.3,
// Property 20). Three checks:
//
//  1. Source: dust and tilt are loaded with a literal dynamic import(), and no
//     desk file imports either module statically.
//  2. Behaviour: with the mode `calm` or `light`, neither importer runs. With
//     `full`, both run once.
//  3. Wiring: DeskDecor reads the mode through `wantsDeskDecor`, so it cannot
//     start the modules outside `full`.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import {
  DESK_DECOR_IMPORTERS,
  loadDeskDecor,
  wantsDeskDecor,
  type DeskDecorImporters,
} from "./decor-loader";

const here = dirname(fileURLToPath(import.meta.url));

/** Importers that record each call and resolve to an empty module. */
function spyImporters() {
  const dust = vi.fn(async () => ({}) as typeof import("./dust"));
  const tilt = vi.fn(async () => ({}) as typeof import("./tilt"));
  const importers: DeskDecorImporters = { dust, tilt };
  return { importers, dust, tilt };
}

describe("source: dust and tilt load by dynamic import()", () => {
  const loaderSource = readFileSync(join(here, "decor-loader.ts"), "utf8");

  it("the default importers call import() for dust and tilt", () => {
    expect(loaderSource).toContain('import("./dust")');
    expect(loaderSource).toContain('import("./tilt")');
    expect(DESK_DECOR_IMPORTERS).toEqual({
      dust: expect.any(Function),
      tilt: expect.any(Function),
    });
  });

  it("no desk file imports dust or tilt statically", () => {
    const files = readdirSync(here).filter(
      (name) =>
        /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && existsSync(join(here, name)),
    );
    expect(files.length).toBeGreaterThan(0);
    const staticImport = /(?:from|import)\s*["']\.\/(dust|tilt)["']/;
    const offenders = files.filter((name) => {
      const code = readFileSync(join(here, name), "utf8").replace(
        /import\s*\(\s*["'][^"']+["']\s*\)/g,
        "",
      );
      return staticImport.test(code);
    });
    expect(offenders).toEqual([]);
  });
});

describe("Calm_Mode and light never import dust or tilt", () => {
  it.each(["calm", "light"] as const)("does not import either module in %s", async (mode) => {
    const { importers, dust, tilt } = spyImporters();
    const result = await loadDeskDecor(mode, importers);
    expect(result).toBeNull();
    expect(dust).not.toHaveBeenCalled();
    expect(tilt).not.toHaveBeenCalled();
  });

  it("imports both modules once in full motion", async () => {
    const { importers, dust, tilt } = spyImporters();
    const result = await loadDeskDecor("full", importers);
    expect(result).not.toBeNull();
    expect(dust).toHaveBeenCalledTimes(1);
    expect(tilt).toHaveBeenCalledTimes(1);
  });

  it("wantsDeskDecor is true only for full", () => {
    expect(wantsDeskDecor("full")).toBe(true);
    expect(wantsDeskDecor("light")).toBe(false);
    expect(wantsDeskDecor("calm")).toBe(false);
  });
});

describe("DeskDecor gates on the motion mode", () => {
  const componentSource = readFileSync(join(here, "DeskDecor.tsx"), "utf8");

  it("loads through loadDeskDecor and checks wantsDeskDecor before rendering", () => {
    expect(componentSource).toContain("loadDeskDecor(mode)");
    expect(componentSource).toContain("wantsDeskDecor(mode)");
  });

  it("calls loadDeskDecor only inside the mount effect, so the modules load after mount", () => {
    const effectAt = componentSource.indexOf("useEffect(");
    const loadAt = componentSource.indexOf("loadDeskDecor(mode)");
    expect(effectAt).toBeGreaterThan(-1);
    expect(loadAt).toBeGreaterThan(effectAt);
    expect(componentSource.match(/loadDeskDecor\(/g)).toHaveLength(1); // the single call in the effect
  });
});
