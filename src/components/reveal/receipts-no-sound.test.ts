// Feature: spec 16, sound in the Top_Bar only.
//
// The receipts column (the receipt cards and figure receipts that show what
// was remembered beside what was sealed) never holds a sound control. The
// sound toggle belongs to the Top_Bar slot, and the Seal_Break reads its state
// through context. This source scan fails if a receipts file imports the
// toggle, the sound module or its context, or names the sound markup. The repo
// runs in node with no DOM, so it reads source.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const here = resolve(__dirname);

/** The receipts column sources. Reveal.tsx is not listed: it also hosts the Seal_Break. */
const RECEIPT_FILES = [
  "ReceiptCard.tsx",
  "FigureReceipt.tsx",
  "receipts.ts",
  "receipt-kind.ts",
] as const;

const SOUND_MARKERS: readonly RegExp[] = [
  /SoundToggle/,
  /data-topbar-sound/,
  /soundNote/,
  /SoundEnabledContext/,
  /SoundSlotContext/,
  /soundCues/,
  /from\s+["'][^"']*\/sound\/[^"']*["']/,
  /from\s+["']\.\.?\/sound\//,
];

describe("the receipts column holds no sound control (spec 16)", () => {
  it.each(RECEIPT_FILES)("%s exists and has no sound control or sound import", (name) => {
    const source = readFileSync(resolve(here, name), "utf8");
    for (const marker of SOUND_MARKERS) {
      expect(source, `${name} matches ${marker}`).not.toMatch(marker);
    }
  });
});
