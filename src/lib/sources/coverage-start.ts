// The fixed coverage start rule for the figure file (spec 04-real-figures, R6.5).
// It lives in its own module, not in prefetch.ts, because the Prefetch_Script
// reads persona coverage from the Persona_List and must hold no date literal
// (spec 18, design.md section 3).

/**
 * The latest start the merged file may have for any series: each series' very
 * first figure must fall on or before this date, so every series reaches back
 * through the demo windows. String comparison of `YYYY-MM-DD` matches the
 * figures layer's own weekly ordering.
 */
export const COVERAGE_LATEST_START = "2023-06-07";
