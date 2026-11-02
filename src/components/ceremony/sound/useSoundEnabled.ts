"use client";

// Feature: 05-reveal-ceremony, Task 10 (R14.1, R14.4)
//
// In-memory sound state for the Ceremony's sound toggle. Sound is off by
// default and the value lives in React state only: no localStorage, no
// cookies, no network. A new page visit starts off again.
//
// This module imports nothing from `sound.ts`. The synthesis module is loaded
// by dynamic import() only after the toggle is turned on (design.md, Property
// 24).

import { useState } from "react";

/** The sound state after one press of the toggle. */
export function nextSoundEnabled(current: boolean): boolean {
  return !current;
}

/** Sound state for the page visit. Starts off; changes only by `setEnabled`. */
export function useSoundEnabled(): {
  enabled: boolean;
  setEnabled: (next: boolean) => void;
} {
  const [enabled, setEnabled] = useState(false);
  return { enabled, setEnabled };
}
