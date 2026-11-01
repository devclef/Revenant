// Feature: 05-reveal-ceremony
//
// Every value the requirements leave to the design, in one module. Nothing here
// is computed from data; these are all plain literals. Property 14 imports this
// module and checks that rendered timings equal these values.
//
// This module must contain no import statement.

// --- Stage motion (ms) ---
export const CAMERA_MOVE_MS = 700;
export const DESK_TO_ENVELOPE_MS = 450; // R8.7
export const STAGE_FADE_MS = 400;
export const CALM_FADE_MS = 120; // R11.2: at most 150

// --- Seal_Break (R6) ---
export const SEAL_HOLD_MS = 1500; // R6.2: press and hold this long to break
export const SEAL_SETTLE_MS = 450; // R6.4: cracks recede on early release
export const SEAL_SHORT_MS = 600; // R6.3: the button's non-gesture version
export const SEAL_SPLIT_MS = 900; // split and flakes
export const FLAP_LIFT_MS = 700;
export const LETTER_SLIDE_MS = 800;
export const FLAKE_COUNT = 14;

// --- Ink (R7.2) ---
export const INK_LINE_DELAY_MS = 220; // per visual line
export const INK_LINE_FADE_MS = 600;
export const INK_TOTAL_MAX_MS = 8000;
// delay actually used: min(INK_LINE_DELAY_MS, floor((INK_TOTAL_MAX_MS - INK_LINE_FADE_MS) / max(lines, 1)))
// It depends only on the number of lines, and the last line ends by 8 s.

// --- Then and now (R12.5, R10.6) ---
export const STAMP_DROP_MS = 520;
export const COUNTER_ROLL_MS = 1100;
export const STEP_HOLD_MS = 600; // pause after the then Step
export const PASSAGE_MS = 2400; // the time-passing transition, any span
export const CHANGE_FADE_MS = 400;

// --- Easing ---
export const EASE_STANDARD = "cubic-bezier(0.2, 0, 0, 1)";
export const EASE_STAMP = "cubic-bezier(0.3, 0, 0.2, 1)";
export const EASE_LINEAR = "linear";

// --- Candle and desk (R11.5, R8.6, R13.6) ---
export const CANDLE_FLICKER_AMPLITUDE = 0.04; // max change in the light layer's opacity
export const CANDLE_FLICKER_MIN_PERIOD_MS = 900; // smooth, no steps; at most about 1.1 changes a second
export const PARALLAX_MAX_DEG = 2;
export const PARALLAX_MAX_PX = 12;
export const DUST_MAX_PARTICLES = 36;
export const DUST_MAX_FPS = 30;
export const LOW_POWER_CORES = 4;
export const LOW_POWER_FRAME_MS = 24;
export const LOW_POWER_PROBE_MS = 1000;

// --- Envelope geometry shared by /demo and the persona page (R8.7) ---
export const ENVELOPE_TARGET = { width: "min(84vw, 26rem)", aspect: 1.6, top: "max(6rem, 14vh)" } as const;

// --- Recall_Scale (R4) ---
export const SCALE_MIN_EXP = -2; // 0.01
export const SCALE_MAX_EXP = 5; // 100,000
export const SCALE_SIG_FIGS = 3;
export const ZOOM_DWELL_MS = 450;
export const ZOOM_DWELL_SLOP_PX = 4;
export const ZOOM_MAX_LEVEL = 2; // 0 whole track, 1 one decade, 2 one tenth of a decade
export const ZOOM_OUT_EDGE_PX = 16;
export const MARKER_HIT_PX = 44;

// --- Number_Line (R12.2) ---
export const LINE_PAD_SPAN_FRACTION = 0.25;
export const LINE_PAD_VALUE_FRACTION = 0.05;
export const LINE_PAD_ZERO = 1; // in the figure's unit, only when then = now = 0

// --- Neutrality (R10.3) ---
export const POSITION_PROPERTIES = ["--pos-mark", "--pos-then", "--pos-now"] as const;
