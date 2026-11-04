// Feature: 07-judge-journey
//
// Starts the Soil_Canvas (design.md "SceneBackdrop and the Soil", R6.1, R6.12,
// R19.5). Pure: the Soil_Canvas module is reached only through the `load`
// argument, so the tests can see whether it was loaded at all. The component
// passes `() => import("./soil-canvas")`, which keeps the chunk out of the
// first-load bundle.
//
// The canvas runs only in full motion. In `light` and `calm` nothing is loaded
// and nothing is mounted, and the Soil_Fallback strip stays on its own. A
// rejected import, or a null 2D context, also leaves the fallback in place.

import type * as SoilCanvasModule from "./soil-canvas";
import type { CeilingInputs, SoilCanvasHandle } from "./soil-canvas";
import type { MotionMode } from "../motion";

export type { SoilCanvasHandle } from "./soil-canvas";

export type SoilCanvasLoad = () => Promise<Pick<typeof SoilCanvasModule, "mountSoilCanvas">>;

export interface StartSoilCanvasOptions {
  /** Current motion mode. Only `full` loads the canvas. */
  mode: MotionMode;
  /** Element the canvas is appended to. */
  container: HTMLElement;
  /** Reads the ceiling inputs from the page. */
  readCeiling: () => CeilingInputs;
  /** Loads the Soil_Canvas module. Called only in full motion. */
  load: SoilCanvasLoad;
}

/**
 * Whether the Soil_Canvas may be loaded at all: the device motion is resolved
 * and the mode is `full`. A loader checks this before it calls `load`, so a
 * first render (still `full`, not yet resolved) requests no chunk on a device
 * that turns out to be `light` or `calm`.
 */
export function soilCanvasMayLoad(state: { mode: MotionMode; ready: boolean }): boolean {
  return state.ready && state.mode === "full";
}

/**
 * Resolves to the mounted handle, or null when the canvas is not used: the mode
 * is not `full`, the import rejected, or the canvas could not get a context.
 */
export async function startSoilCanvas(options: StartSoilCanvasOptions): Promise<SoilCanvasHandle | null> {
  if (options.mode !== "full") {
    return null;
  }
  try {
    const mod = await options.load();
    return mod.mountSoilCanvas({
      container: options.container,
      mode: "full",
      readCeiling: options.readCeiling,
    });
  } catch {
    return null;
  }
}

/** The vertical offset from a computed `transform` value. 0 when there is none. */
export function parseTranslateY(transform: string): number {
  const m = /^matrix\(([^)]+)\)$/.exec(transform.trim());
  if (!m) {
    return 0;
  }
  const parts = m[1].split(",").map((p) => Number(p.trim()));
  const ty = parts[5];
  return Number.isFinite(ty) ? ty : 0;
}
