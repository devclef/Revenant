// Server-only runtime configuration for the letter store.
//
// This module must never be imported by browser code. The guard below throws
// if it is bundled into a client component, matching `clock.ts`.
if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/letter-store/config.ts is server-only and must not be imported in the browser.",
  );
}

/**
 * The passkey relying-party ID (`RP_ID`), trimmed.
 *
 * Returns `null` when the variable is unset, empty or only whitespace, so the
 * caller decides what a missing RP ID means.
 */
export function readRpId(): string | null {
  const raw = process.env.RP_ID?.trim();
  return raw ? raw : null;
}
