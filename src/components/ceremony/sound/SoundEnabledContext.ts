// Feature: 05-reveal-ceremony, Task 10 (R14.1, R14.5)
//
// Carries the sound toggle's state from CeremonyRoot down to SealBreak. The
// default is off, so a view rendered outside CeremonyRoot stays silent.

import { createContext } from "react";

export const SoundEnabledContext = createContext<boolean>(false);
