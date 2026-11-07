// Feature: 09-demo-polish (landing hero, B1, B4 and Group P)
//
// Layout constants for the landing hero. The values are design.md
// "Constants" (landing/constants.ts rows). landing.module.css repeats them as
// literals; constants.test.ts checks that the stylesheet matches.
//
// FLOW_MINUTES is deliberately NOT defined here. design.md gives 2, but it
// also says the owner measured the persona flow (B1.7) and wrote the timings
// into issue #255's body, which this task cannot read. A number is not
// invented, so the value waits for the owner's timing. Until then, the hero
// omits the `primaryCost` line.

/** Below this width the hero stacks and the phone layout applies (Group P). */
export const PHONE_BELOW_PX = 600;

/** The Landing_Ghost box on the phone, at most this tall (OD12 c, P1.1). */
export const LANDING_GHOST_PHONE_MAX_PX = 190;

/** The largest gap allowed between data-block boxes on the phone (P2.1). */
export const DEAD_SPACE_MAX_PX = 64;

/** The smallest side of a touch target on the phone (P8.4). */
export const TOUCH_TARGET_MIN_PX = 44;

/** From this width the headline scales up and the hero centres (B4.1). */
export const LANDING_WIDE_MIN_PX = 1920;
