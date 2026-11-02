"use client";

import { useEffect, useState } from "react";
import { OpeningFlow } from "@/components/reveal/OpeningFlow";
import { takeBackupKeyFromLocation } from "@/lib/cards";
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
  // The backup key from the `#k=` fragment (R21.6). It is read and removed
  // from the address bar in the mount effect, before the flow renders, so no
  // request starts while the key is still in the URL. `undefined` means the
  // effect has not run yet, and the flow waits.
  const [backupKey, setBackupKey] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    setBackupKey(takeBackupKeyFromLocation(window));
  }, []);

  if (backupKey === undefined) {
    return null;
  }

  return (
    <OpeningFlow
      mode="live"
      letterId={letterId}
      personaName={LIVE_COPY.regionLabel}
      initialBackupKey={backupKey ?? undefined}
    />
  );
}
