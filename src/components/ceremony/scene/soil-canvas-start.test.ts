// Feature: 07-judge-journey (spec 07 task 4)
//
// The Soil_Canvas loader gating and fallback (design.md "SceneBackdrop and the
// Soil", R6.1, R6.12). The environment is node, so the helper is tested with an
// injected loader: a spy shows whether the module was ever requested.

import { describe, expect, it, vi } from "vitest";

import type { CeilingInputs, SoilCanvasHandle } from "./soil-canvas";
import { parseTranslateY, startSoilCanvas } from "./soil-canvas-start";

const CEILING: CeilingInputs = { barBottom: 60, headlineBottom: null, translateY: 0 };

function fakeHandle(): SoilCanvasHandle {
  return { setMode: vi.fn(), refreshCeiling: vi.fn(), destroy: vi.fn() };
}

function fakeContainer(): HTMLElement {
  return {} as HTMLElement;
}

describe("startSoilCanvas: calm and light never load the canvas", () => {
  it("does not call the loader in calm", async () => {
    const load = vi.fn(async () => ({ mountSoilCanvas: vi.fn(() => fakeHandle()) }));
    const handle = await startSoilCanvas({
      mode: "calm",
      container: fakeContainer(),
      readCeiling: () => CEILING,
      load,
    });
    expect(handle).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it("does not call the loader in light", async () => {
    const load = vi.fn(async () => ({ mountSoilCanvas: vi.fn(() => fakeHandle()) }));
    const handle = await startSoilCanvas({
      mode: "light",
      container: fakeContainer(),
      readCeiling: () => CEILING,
      load,
    });
    expect(handle).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });
});

describe("startSoilCanvas: full motion mounts the canvas", () => {
  it("loads the module once and mounts it in full mode with the container and ceiling reader", async () => {
    const container = fakeContainer();
    const handle = fakeHandle();
    const mountSoilCanvas = vi.fn(() => handle);
    const load = vi.fn(async () => ({ mountSoilCanvas }));
    const readCeiling = () => CEILING;

    const started = await startSoilCanvas({ mode: "full", container, readCeiling, load });

    expect(load).toHaveBeenCalledTimes(1);
    expect(mountSoilCanvas).toHaveBeenCalledWith({ container, mode: "full", readCeiling });
    expect(started).toBe(handle);
  });
});

describe("startSoilCanvas: the fallback stays when the canvas cannot start", () => {
  it("returns null when the import rejects", async () => {
    const load = vi.fn(async () => {
      throw new Error("chunk failed to load");
    });
    const handle = await startSoilCanvas({
      mode: "full",
      container: fakeContainer(),
      readCeiling: () => CEILING,
      load,
    });
    expect(handle).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("returns null when mountSoilCanvas finds no 2D context", async () => {
    const load = vi.fn(async () => ({ mountSoilCanvas: vi.fn(() => null) }));
    const handle = await startSoilCanvas({
      mode: "full",
      container: fakeContainer(),
      readCeiling: () => CEILING,
      load,
    });
    expect(handle).toBeNull();
  });

  it("returns null when mounting throws", async () => {
    const load = vi.fn(async () => ({
      mountSoilCanvas: vi.fn(() => {
        throw new Error("no canvas");
      }),
    }));
    const handle = await startSoilCanvas({
      mode: "full",
      container: fakeContainer(),
      readCeiling: () => CEILING,
      load,
    });
    expect(handle).toBeNull();
  });
});

describe("parseTranslateY", () => {
  it("reads the vertical offset from a 2D matrix", () => {
    expect(parseTranslateY("matrix(1, 0, 0, 1, 0, -42)")).toBe(-42);
  });

  it("is 0 for no transform or an unrecognised form", () => {
    expect(parseTranslateY("none")).toBe(0);
    expect(parseTranslateY("matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,-5,0,1)")).toBe(0);
  });
});
