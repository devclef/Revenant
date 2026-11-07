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
//
// Two forms (spec 09 C4.4, P5.2). `desk` is the text control on the desk. `topbar`
// is the Top_Bar control: the Calm look at 600 px and wider, and an icon button
// with its label as the accessible name below 600 px (OD13 a).
//
// Pass `enabled` to control the state from a parent (the Top_Bar does, because
// the Seal_Break reads the same state). Without it, the toggle keeps its own.

import { SoundIcon } from "../scene/icons";
import topbarStyles from "../scene/scene.module.css";
import styles from "../ceremony.module.css";
import { CEREMONY_COPY } from "../copy";
import { nextSoundEnabled, useSoundEnabled } from "./useSoundEnabled";

export type SoundToggleProps = {
  /** Called with the new state after each press. Optional. */
  onChange?: (enabled: boolean) => void;
  /** Controlled state. When given, the toggle shows it and keeps none of its own. */
  enabled?: boolean;
  /** Which look to use. Default `desk`. */
  variant?: "desk" | "topbar";
  /** Top_Bar only: marks this as the last control in the bar (data-topbar-last). */
  last?: boolean;
};

export function SoundToggle({
  onChange,
  enabled: controlled,
  variant = "desk",
  last = false,
}: SoundToggleProps) {
  const own = useSoundEnabled();
  const enabled = controlled ?? own.enabled;

  const press = () => {
    const next = nextSoundEnabled(enabled);
    if (controlled === undefined) own.setEnabled(next);
    onChange?.(next);
  };

  if (variant === "topbar") {
    const label = enabled ? CEREMONY_COPY.soundOff : CEREMONY_COPY.soundOn;
    return (
      <button
        type="button"
        className={topbarStyles.control}
        aria-pressed={enabled}
        aria-label={label}
        title={label}
        data-topbar-sound
        data-topbar-last={last ? true : undefined}
        onClick={press}
      >
        <SoundIcon off={!enabled} className={topbarStyles.controlIcon} />
        <span className={topbarStyles.controlLabel}>{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={styles.deskControl}
      aria-pressed={enabled}
      onClick={press}
    >
      {enabled ? CEREMONY_COPY.soundOff : CEREMONY_COPY.soundOn}
    </button>
  );
}
