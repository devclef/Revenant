// Feature: 05-reveal-ceremony
//
// The import gate for the desk's decorative modules (design.md "Desk", R13.3,
// R11.3, Property 20). `dust.ts` and `tilt.ts` are loaded here, by dynamic
// import(), and only in `full` motion. In `light` and `calm` neither module is
// imported at all, so Calm_Mode never fetches or runs them.
//
// The importers are a parameter so tests can see whether they run. The default
// importers are the only place the two `import()` calls appear.

import type { MotionMode } from "../motion";

/** The two decorative modules, once loaded. */
export type DeskDecorModules = {
  readonly dust: typeof import("./dust");
  readonly tilt: typeof import("./tilt");
};

/** How the decorative modules are loaded. Injected so tests can spy on them. */
export type DeskDecorImporters = {
  readonly dust: () => Promise<typeof import("./dust")>;
  readonly tilt: () => Promise<typeof import("./tilt")>;
};

/** The real importers. Each call is a dynamic import(), so the code is split out of the page bundle. */
export const DESK_DECOR_IMPORTERS: DeskDecorImporters = {
  dust: () => import("./dust"),
  tilt: () => import("./tilt"),
};

/** Dust and tilt run only in `full` motion. `light` turns both off (R13.6); `calm` never starts them (R11.3). */
export function wantsDeskDecor(mode: MotionMode): boolean {
  return mode === "full";
}

/**
 * Load the decorative modules for `mode`. Resolves `null` without importing
 * anything when the mode is not `full`. Otherwise it loads both modules and
 * resolves them together.
 */
export async function loadDeskDecor(
  mode: MotionMode,
  importers: DeskDecorImporters = DESK_DECOR_IMPORTERS,
): Promise<DeskDecorModules | null> {
  if (!wantsDeskDecor(mode)) {
    return null;
  }
  const [dust, tilt] = await Promise.all([importers.dust(), importers.tilt()]);
  return { dust, tilt };
}
