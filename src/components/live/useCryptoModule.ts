"use client";

// Loads the browser crypto barrel once the component has mounted (spec 06,
// design.md "The first-async-step rule and crypto preload").
//
// A passkey prompt must start in the same tick as its click, so the crypto
// module has to be loaded before the click. This hook starts the dynamic
// import in an effect and returns the module once it arrives, or `null` until
// then. The prompt controls stay disabled while it is `null` (R15.3).
//
// This is one of two files under src/components that may import
// "@/lib/crypto" (the other is src/components/reveal/useOpeningFlow.ts). The
// import must stay dynamic; the import-boundary test enforces that.

import { useEffect, useState } from "react";

import type { CryptoModule } from "./crypto-module";

export function useCryptoModule(): CryptoModule | null {
  const [crypto, setCrypto] = useState<CryptoModule | null>(null);

  useEffect(() => {
    let active = true;

    import("@/lib/crypto").then(
      (module) => {
        if (active) setCrypto(module);
      },
      () => {
        // A failed load leaves the module as null, so the prompt controls
        // stay disabled. The Seal_Page shows its own status line.
      },
    );

    return () => {
      active = false;
    };
  }, []);

  return crypto;
}
