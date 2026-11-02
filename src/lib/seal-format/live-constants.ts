// Time-lock constants for Live_Letters (the 30-second demo letters).
//
// These values are shared by the server (letter store) and the browser (seal
// page). They are part of the sealed contract: changing one changes which
// letters the server accepts, so they are not tuned per request.
//
// Pure module: no imports, safe for browser and server.

/** The fixed time lock of a Live_Letter: opensAt - sealedAt, in milliseconds. */
export const LOCK_DURATION_MS = 30_000;

/** How long a prepared draft stays usable before the seal must arrive. */
export const DRAFT_LIFETIME_MS = 600_000;

/** Largest allowed gap between server time and opensAt when sealing. */
export const LOCK_MAX_AHEAD_MS = 60_000;
