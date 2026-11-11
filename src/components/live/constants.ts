// UI limits for the live demo Seal_Page (spec 06-lock-and-unlock, design.md
// "Constants"). The server enforces its own limits; these keep the form honest
// before a request is sent.
//
// Pure module: no imports, safe in the browser and on the server.

/** Longest letter the form accepts, counted in Unicode code points (R12.4). */
export const MAX_LETTER_CODE_POINTS = 5000;

/** Most figures a letter may carry (R13.2). */
export const MAX_FIGURES = 6;

/** How often the countdown on the sealed view refreshes, in milliseconds (R16.2). */
export const COUNTDOWN_TICK_MS = 250;

/**
 * Rows the letter textarea starts with on a phone (spec 09 P9). Three rows
 * keep the Next button inside a 360x640 viewport under the headline (PH1); the
 * field still grows with the text up to LETTER_FIELD_MAX_VH.
 */
export const LETTER_FIELD_ROWS = 3;

/**
 * Most of the visual viewport the letter textarea may grow to, in percent
 * (spec 09 P9). Past this it scrolls inside the field.
 */
export const LETTER_FIELD_MAX_VH = 50;

/** Smallest touch target on a phone, in CSS pixels (spec 09 P8.4). */
export const MIN_TOUCH_TARGET_PX = 44;

/** The two phone sizes the layout check walks (spec 09 P10). */
export const PHONE_SIZES = [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
] as const;

/** Most self-reported numbers a letter may carry (spec 08 later-tasks, R1). */
export const SELF_REPORTED_MAX = 10;

/** Longest name, unit or region of a self-reported number, in code points. */
export const SELF_REPORTED_TEXT_MAX = 60;

/** Largest self-reported value. The lowest is 0. */
export const SELF_REPORTED_VALUE_MAX = 999999999;

/** Most decimal places a self-reported value may have. */
export const SELF_REPORTED_DECIMALS_MAX = 4;
