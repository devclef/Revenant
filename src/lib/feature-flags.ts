import "server-only";

// Server-only feature flags. Importing `server-only` makes the build fail if a
// client component tries to load this module.

/**
 * Real (passkey-sealed) letters are on only when REAL_SEALING is exactly "on"
 * after trimming surrounding whitespace. Unset, empty, and any other value,
 * including "ON", "true" and "1", leave real sealing off.
 */
export function realSealingOn(): boolean {
  return process.env.REAL_SEALING?.trim() === "on";
}
