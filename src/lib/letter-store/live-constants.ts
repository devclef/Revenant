// Server-only limits and lock keys for the Live_Letter routes.
//
// The 30-second lock values live in `@/lib/seal-format/live-constants` because
// the browser needs them too. The values here are server-only limits.
//
// This module must never be imported by browser code. The guard below throws
// if it is bundled into a client component, matching `clock.ts`.
if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/letter-store/live-constants.ts is server-only and must not be imported in the browser.",
  );
}

/** Maximum number of live drafts kept at once. */
export const DRAFT_CAP = 1_000;

/** Maximum number of Live_Letters sealed inside LIVE_SEAL_WINDOW_MS. */
export const LIVE_SEAL_CAP = 500;

/** Rolling window for LIVE_SEAL_CAP: 24 hours. */
export const LIVE_SEAL_WINDOW_MS = 86_400_000;

/** Largest accepted seal request body, in characters. */
export const SEAL_BODY_MAX_CHARS = 100_000;

/** Attempts to find an unused draft ID before giving up. */
export const PREPARE_ID_ATTEMPTS = 3;

/** Postgres advisory lock key taken by createDraft. */
export const PREPARE_LOCK_KEY = 70601;

/** Postgres advisory lock key taken by storeLiveLetter. */
export const SEAL_LOCK_KEY = 70602;

/** The `kind` value stored for Live_Letters. */
export const LIVE_KIND = "live";
