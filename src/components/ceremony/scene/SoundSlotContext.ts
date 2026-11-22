// Feature: 09-demo-polish (spec 16 receipts, live column and sound)
//
// Lets the Opening_Flow tell the Scene that it has mounted. The Top_Bar sound
// slot on a plain page (`/demo/live`, `/l/[id]`) is reserved with
// `visibility: hidden` until the flow reports here, so the control appears only
// on the page that actually plays the Seal_Break. The default is a no-op, so a
// flow rendered outside a plain Scene reports to nothing.

import { createContext } from "react";

export const SoundSlotContext = createContext<() => void>(() => {});
