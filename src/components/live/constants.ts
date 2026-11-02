// UI limits for the live demo Seal_Page (spec 06-lock-and-unlock, design.md
// "Constants"). The server enforces its own limits; these keep the form honest
// before a request is sent.
//
// Pure module: no imports, safe in the browser and on the server.

/** Longest letter the form accepts, counted in Unicode code points (R12.4). */
export const MAX_LETTER_CODE_POINTS = 5000;

/** Fewest figures a letter must carry (R13.2). */
export const MIN_FIGURES = 1;

/** Most figures a letter may carry (R13.2). */
export const MAX_FIGURES = 6;

/** How often the countdown on the sealed view refreshes, in milliseconds (R16.2). */
export const COUNTDOWN_TICK_MS = 250;
