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

// --- Layout (R5.15 to R5.18, R6.14, R8.1, R14.1) (spec 07) ---
export const SCENE_BREAKPOINT_PX = 900; // the one R14.1 breakpoint
export const TOP_BAR_MAX_PX = 96; // at 360 x 640 (measured 65.2, or 80.0 with a two-line notice)
export const SOIL_TOP_WIDE_VH = 74;
export const SOIL_TOP_NARROW_VH = 69;
export const SOIL_BAND_WIDE_VH = 14; // 112 px at 1280 x 800
export const SOIL_BAND_NARROW_VH = 8; // 51.2 px at 360 x 640
export const SCENE_FRAME_MAX_PX = 1440; // Scene_Frame width is min(100vw, 1440px) (R8.14)
export const GHOST_X_IN_FRAME = 0.72; // Ghost_Box centre and light x, share of the Scene_Frame, every Stage (R5.16, R6.17)
export const GHOST_X_NARROW = 0.5; // share of the window below 900 px
export const GHOST_WIDE = "min(50vh, 560px)"; // Ghost_Box width at or above 900 px (R5.15)
export const GHOST_NARROW = "min(31vh, 200px)";
export const GHOST_HEIGHT_RATIO = 1.2; // Ghost_Box height / width
export const CONTENT_COLUMN_MAX = "min(34rem, 46vw)"; // R5.18
export const GHOST_RISEN_WIDE = -0.07; // translateY, share of ghost height
export const GHOST_RISEN_NARROW = -0.03;
export const GHOST_HANDED = -0.12;
export const NARROW_GHOST_SCALE = 0.8; // R10.15
export const HELD_LEFT = 0.18;
export const HELD_WIDTH = 0.64;
export const HELD_TOP_WIDE = 0.48;
export const HELD_TOP_NARROW = 0.47;
export const ENVELOPE_ASPECT_WIDE = 1.45;
export const ENVELOPE_ASPECT_NARROW = 1.3;
export const ENVELOPE_FRONT_MIN_PX = 12; // R8.12
export const ENVELOPE_DIRT_BAND = 0.22; // share of face height
export const SEAL_WIDTH_WIDE = 0.27; // share of envelope width
export const SEAL_WIDTH_NARROW = 0.32;
export const SEAL_HIT_MIN_PX = 60; // before scale; at least 48 at 0.8 (R10.16)
export const COLUMN_GAP_UNDER_SOIL_PX = 4;
export const DUST_CEILING_GAP_PX = 8; // R6.16

// --- Landing light (R7.1, R6.10) (spec 07) ---
export const LANDING_LIGHT_AT_MS = 250;
export const LIGHT_FADE_MS = 900;
export const LIGHT_MOVE_MS = 1100;
export const LIGHT_MAX_LUMINANCE_CHANGE_PER_S = 0.1;

// --- Emergence (R9.5, R9.6, R18.2, R18.8) (spec 07) ---
export const SHAKE_AT_MS = 750;
export const SHAKE_MS = 500;
export const SHAKE_PX = 2;
export const RISE_AT_MS = 900;
export const RISE_MS = 1500;
export const EASE_RISE = "cubic-bezier(0.16, 0.84, 0.3, 1)";

// --- Idle_Bob and eyes (R5.5, R5.10, R5.11, R18.10) (spec 07) ---
export const BOB_PX = 3;
export const BOB_PERIOD_MS = 3600;
export const EYE_MAX_OFFSET = 5; // SVG units, length of the offset
export const EYE_MAX_X = 5;
export const EYE_MAX_Y = 4;
export const EYE_FOLLOW_RADIUS_PX = 320;
export const EYE_TRANSITION_MS = 120;
