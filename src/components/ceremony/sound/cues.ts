// Feature: 05-reveal-ceremony, Task 10 (R14.2, R14.5; Property 24)
//
// The sound cues for the Seal_Break. This module is what the Ceremony calls;
// it decides when `sound.ts` is loaded and whether anything plays.
//
// `sound.ts` is loaded by a dynamic import() only on the first turn-on of the
// toggle (`onToggle(true)`). A break while sound is off plays nothing, vibrates
// nothing and loads nothing (R14.5). The loader is injected so the property
// tests can count loads without touching the real module.
//
// No static import of `sound.ts` lives here. The type of the module is spelled
// out below, so this file stays free of a value import of it.

/** The part of `sound.ts` this module uses. */
export type SoundModule = {
  play: (cue: "seal-break", enabled: boolean) => boolean;
  vibrate: (enabled: boolean) => boolean;
};

/** Loads the synthesis module. Called at most once per controller. */
export type SoundModuleLoader = () => Promise<SoundModule>;

export type SoundCues = {
  /**
   * Called with the new state after each press of the toggle. Loads the sound
   * module on the first turn-on; turning sound off loads nothing.
   */
  onToggle: (enabled: boolean) => void;
  /**
   * Called once when the Seal_Break happens. Plays the break cue and vibrates
   * only while sound is on. Resolves without loading anything while it is off.
   */
  sealBreak: (enabled: boolean) => Promise<void>;
};

/**
 * Build a cue controller around a loader. The loader runs at most once; its
 * result is shared by every later cue. A failed load leaves the seal silent and
 * lets a later turn-on try again.
 */
export function createSoundCues(load: SoundModuleLoader): SoundCues {
  let pending: Promise<SoundModule> | null = null;

  const moduleOnce = (): Promise<SoundModule> => {
    if (pending === null) {
      pending = load().catch((error: unknown) => {
        pending = null;
        throw error;
      });
    }
    return pending;
  };

  return {
    onToggle(enabled) {
      if (enabled) {
        moduleOnce().catch(() => {
          // Sound is optional. The break still shows, only silently.
        });
      }
    },
    async sealBreak(enabled) {
      if (!enabled) return;
      try {
        const mod = await moduleOnce();
        mod.play("seal-break", true);
        mod.vibrate(true);
      } catch {
        // A failed load or an unsupported API leaves the break silent.
      }
    },
  };
}

/** The app's cue controller. The dynamic import is the only load of sound.ts. */
export const soundCues: SoundCues = createSoundCues(() => import("./sound"));
