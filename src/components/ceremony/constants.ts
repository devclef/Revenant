// Feature: 05-reveal-ceremony
//
// Every value the requirements leave to the design, in one module. Nothing here
// is computed from data; these are all plain literals. Property 14 imports this
// module and checks that rendered timings equal these values.
//
// This module must contain no import statement.

// --- Stage motion (ms) ---
export const STAGE_FADE_MS = 400;
export const CALM_FADE_MS = 120; // R11.2: at most 150

// --- Seal_Break (R6) ---
export const SEAL_HOLD_MS = 1500; // R6.2: press and hold this long to break
export const SEAL_SETTLE_MS = 300; // R6.4: cracks recede on early release
export const SEAL_SHORT_MS = 450; // R6.3: the button's non-gesture version
export const SEAL_SPLIT_MS = 520; // the two seal halves fall apart
export const FLAP_LIFT_MS = 450;
export const LETTER_SLIDE_MS = 600;
export const FLAKE_COUNT = 14;

// --- Figures (R14.7, R14.8, R18.5) (spec 07 task 6) ---
export const FIG_FADE_MS = 450;
export const FIG_STAGGER_MS = 60; // at most 100 (R14.7)
export const FIG_START_DELAY_MS = 30;
export const MAX_FIGURES = 6; // equals the spec 06 MAX_FIGURES; constants.test.ts checks it
export const FIG_TOTAL_MS = 750; // FIG_FADE_MS + FIG_STAGGER_MS * (MAX_FIGURES - 1)
export const FIG_CLOCK_MS = 780; // FIG_START_DELAY_MS + FIG_TOTAL_MS: the column clock, any count

// --- Easing ---
export const EASE_STANDARD = "cubic-bezier(0.2, 0, 0, 1)";
export const EASE_STAMP = "cubic-bezier(0.3, 0, 0.2, 1)";
export const EASE_LINEAR = "linear";

// --- Low-power probe (R13.6) ---
export const LOW_POWER_CORES = 4;
export const LOW_POWER_FRAME_MS = 24;
export const LOW_POWER_PROBE_MS = 1000;

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
export const GHOST_NARROW = "min(26vh, 170px)";
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
export const GHOST_LIFT_MS = 400; // R10.7: the Ghost lifts to the handed pose
export const ENVELOPE_TURN_AT_MS = 400; // R10.8: the turn starts once the Ghost lifts
export const ENVELOPE_TURN_MS = 520; // R10.8: the turn ends by 920 ms, inside 1,200 ms
export const PICKUP_MOVE_MS = 600; // R10.15: the narrow scene lift and pit scale
export const COLUMN_GAP_UNDER_SOIL_PX = 4;
export const DUST_CEILING_GAP_PX = 8; // R6.16
// --- Soil_Canvas (R6.3, R6.5) (spec 07) ---
export const DUST_MAX_PARTICLES = 36;
export const DUST_MAX_FPS = 30;
export const EDGE_BAND_PX = 14; // R6.3: the soil's top-edge jag stays inside this band
export const LIGHT_MAX_LUMINANCE_CHANGE_PER_S = 0.1;
export const SOIL_SEED = 0x07a11e;
export const DUST_SEED = 0x077149; // SOIL_SEED ^ 0xd057, the dust stream
export const CLOD_SEED = 0x076013; // SOIL_SEED ^ 0xc10d, the clod stream
export const CLOD_COUNT = 16;
export const CLOD_LIFE_MS = 1600;
export const CLOD_GRAVITY_PX_S2 = 620;
export const SOIL_DPR_MAX = 2;
export const SOIL_RESIZE_DEBOUNCE_MS = 150;
export const DUST_SPREAD = 0.2; // share of width either side of the light

// --- Landing light (R7.1, R6.10) (spec 07) ---
export const LANDING_LIGHT_AT_MS = 250;
export const LIGHT_FADE_MS = 900;
export const LIGHT_MOVE_MS = 1100;

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

// --- Break and letter (R12.6, R12.7, R18.4) (spec 07 task 5) ---
export const GHOST_LEAVE_MS = 1100;
export const GHOST_FADE_MS = 900;
export const EASE_LEAVE = "cubic-bezier(0.4, 0, 0.6, 1)";
export const FLAP_AT_MS = 250;
export const LETTER_SLIDE_AT_MS = 550;
export const UNFOLD_AT_MS = 1150;
export const UNFOLD_MS = 520;
export const REVEAL_DIM_OPACITY = 0.18;
export const REVEAL_DIM_MS = 500;
