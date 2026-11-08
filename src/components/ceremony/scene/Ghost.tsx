// Feature: 07-judge-journey
//
// The Ghost drawing (design.md "The Ghost", R5.1 to R5.14, R9.5 to R9.7). One
// inline SVG drawn in this repository, recorded in ASSETS.md. It is the past
// self, not Kiro's logo or mascot. It has no hood, hands, arms or mouth.
//
// This module is server-safe: no hooks, no browser APIs, no "use client". It
// renders from props only. The motion, the Stage pose, the Skip registration,
// the Emergence rise and the pointer eye follow live in PersonaGhost.tsx,
// which owns the state and passes it down. The one listener, animationend on
// the rise, is attached only when a client caller passes onExitEnd, so the
// landing page (a server component) renders it without any handler.
//
// Layers, outside to inside:
//   .pit        the Emergence shake (the pit is the Ghost's placement)
//   .ghostPlace the Ghost_Box position, clipped at the Soil line
//   .ghost      the rise, from below the Soil to the risen pose (data-ghost-rise)
//   .bob        the Idle_Bob, and the held Envelope's slot (.heldSlot)
//   svg         the drawing, with the eyes group that follows the pointer

import type { AnimationEvent, CSSProperties, ReactNode, Ref } from "react";

import { EYE_TRANSITION_MS, GHOST_SIZE_COMPACT, GHOST_SIZE_FULL } from "../constants";
import styles from "./scene.module.css";
import {
  BODY_PATH,
  EYE_CENTRES,
  EYE_RADII,
  FOLDS_PATH,
  VIEWBOX,
  type EyeOffset,
} from "./ghost-geometry";

/** The Ghost's pose: the risen end pose, or the handed pose once picked up. */
export type GhostPose = "risen" | "handed";

/** The Ghost's size: the full drawing, or the Compact_Ghost at the Phone_Sizes (spec 09 P4.2). */
export type GhostSize = typeof GHOST_SIZE_FULL | typeof GHOST_SIZE_COMPACT;

/**
 * The sink state on a stored seal (spec 09 D1). `idle` shows no sink. `sinking`
 * plays the ghostSink animation in full motion. `sunk` holds the settled pose
 * with no motion, which is also what Calm and reduced motion show.
 */
export type GhostSink = "idle" | "sinking" | "sunk";

const NO_OFFSET: EyeOffset = { dx: 0, dy: 0 };

export type GhostProps = {
  /** The pose, set by the Stage. Defaults to the risen end pose. */
  pose?: GhostPose;
  /** The size. Defaults to the full drawing. */
  size?: GhostSize;
  /** The sink state. Defaults to idle (no sink). */
  sink?: GhostSink;
  /** The eyes' offset in SVG user units. Defaults to the centre. */
  eyes?: EyeOffset;
  /** The id of the body gradient. Must be unique in the page. */
  gradientId?: string;
  /** True while the Ghost leaves after a completed break (data-leaving). */
  leaving?: boolean;
  /** The ref for the rise element (.ghost), for the Emergence hook. */
  riseRef?: Ref<HTMLDivElement>;
  /** The leave timings as CSS variables. */
  leaveVars?: CSSProperties;
  /** Extra attributes for the root (pit) element, for example data-ghost. */
  rootAttributes?: Record<string, string>;
  /** Called with the animation name when an animation on the rise element ends. */
  onExitEnd?: (animationName: string) => void;
  /** The held Envelope, rendered in the bob's slot. */
  children?: ReactNode;
};

/**
 * The animationend listener for the rise element. It exists only when a caller
 * passes `onExitEnd` (the persona Ghost, which is a client component). The
 * landing page renders this drawing on the server without a callback, so the
 * server render never carries an event-handler prop.
 */
function riseListeners(
  onExitEnd: ((animationName: string) => void) | undefined,
): { onAnimationEnd?: (event: AnimationEvent<HTMLDivElement>) => void } {
  if (onExitEnd === undefined) return {};
  return {
    onAnimationEnd: (event) => {
      // animationend bubbles from children, so only the rise's own counts.
      if (event.target !== event.currentTarget) return;
      onExitEnd(event.animationName);
    },
  };
}

/**
 * The Ghost drawing. `children` render in the held slot, inside the bob, so an
 * Envelope held by the Ghost moves with it (R5.2).
 */
export function Ghost({
  pose = "risen",
  size = GHOST_SIZE_FULL,
  sink = "idle",
  eyes = NO_OFFSET,
  gradientId = "ghost-body",
  leaving = false,
  riseRef,
  leaveVars,
  rootAttributes,
  onExitEnd,
  children,
}: GhostProps) {
  return (
    <div
      className={styles.pit}
      data-pose={pose}
      data-size={size}
      data-ghost-pit
      {...rootAttributes}
    >
      <div className={styles.ghostPlace}>
        <div
          ref={riseRef}
          className={styles.ghost}
          data-pose={pose}
          data-leaving={leaving ? "true" : undefined}
          data-sink={sink === "idle" ? undefined : sink}
          data-ghost-rise
          style={leaveVars}
          {...riseListeners(onExitEnd)}
        >
          <div className={styles.bob} data-ghost-bob>
            <div className={styles.ghostGlow}>
              <svg
                className={styles.ghostSvg}
                viewBox={VIEWBOX}
                aria-hidden="true"
                focusable="false"
                data-ghost-box
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" style={{ stopColor: "var(--ghost-top)" }} />
                    <stop offset="0.45" style={{ stopColor: "var(--ghost-mid)" }} />
                    <stop offset="1" style={{ stopColor: "var(--ghost-hem)" }} />
                  </linearGradient>
                </defs>
                <path d={BODY_PATH} fill={`url(#${gradientId})`} />
                <path d={FOLDS_PATH} className={styles.ghostFold} />
                <g
                  style={{
                    transform: `translate(${eyes.dx}px, ${eyes.dy}px)`,
                    transition: `transform ${EYE_TRANSITION_MS}ms linear`,
                  }}
                >
                  {EYE_CENTRES.map((eye) => (
                    <ellipse
                      key={eye.cx}
                      cx={eye.cx}
                      cy={eye.cy}
                      rx={EYE_RADII.rx}
                      ry={EYE_RADII.ry}
                      className={styles.ghostEye}
                    />
                  ))}
                </g>
              </svg>
            </div>
            <div className={styles.heldSlot}>{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
