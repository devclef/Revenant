"use client";

// Feature: 05-reveal-ceremony, Task 10 (R14.1, R14.4)
//
// The sound toggle. It sits on the desk, so it uses the desk control look from
// ceremony.module.css, like the Calm and Skip controls. Off by default, with
// aria-pressed reflecting the state. The state is in memory only (see
// useSoundEnabled.ts).
//
// This component does not import sound.ts. The parent receives `onChange` and
// decides when to load the synthesis module.

import styles from "../ceremony.module.css";
import { CEREMONY_COPY } from "../copy";
import { nextSoundEnabled, useSoundEnabled } from "./useSoundEnabled";

export type SoundToggleProps = {
  /** Called with the new state after each press. Optional. */
  onChange?: (enabled: boolean) => void;
};

export function SoundToggle({ onChange }: SoundToggleProps) {
  const { enabled, setEnabled } = useSoundEnabled();

  return (
    <button
      type="button"
      className={styles.deskControl}
      aria-pressed={enabled}
      onClick={() => {
        const next = nextSoundEnabled(enabled);
        setEnabled(next);
        onChange?.(next);
      }}
    >
      {enabled ? CEREMONY_COPY.soundOff : CEREMONY_COPY.soundOn}
    </button>
  );
}
