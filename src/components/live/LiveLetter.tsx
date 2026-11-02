import { OpeningFlow } from "@/components/reveal/OpeningFlow";
import { LIVE_COPY } from "./copy";

/**
 * The Live_Letter view on the Letter_Page (spec 06, design.md "Letter_Page").
 *
 * It renders the Opening_Flow in live mode for one letter ID: the reader
 * unlocks with a passkey or a backup key, and the letter opens after the
 * server releases the secret. The letter ID comes from the server page, which
 * checked its shape with `isLetterId`. The region label is the live copy's
 * `regionLabel`, so the page never names a persona.
 *
 * This module imports no crypto module. The Opening_Flow loads crypto only
 * through its dynamic import.
 */
export function LiveLetter({ letterId }: { letterId: string }) {
  return (
    <OpeningFlow
      mode="live"
      letterId={letterId}
      personaName={LIVE_COPY.regionLabel}
    />
  );
}
