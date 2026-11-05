// Feature: 07-judge-journey
//
// The Ghost drawing (design.md "The Ghost", R5.1 to R5.14, R9.5 to R9.7). One
// inline SVG drawn in this repository, recorded in ASSETS.md. It is the past
// self, not Kiro's logo or mascot. It has no hood, hands, arms or mouth.
//
// This module is server-safe: no hooks, no browser APIs, no "use client". It
// renders from props only. The motion, the Stage pose, the Skip registration,
// the Emergence rise and the pointer eye follow live in PersonaGhost.tsx,
// which owns the state and passes it down.
//
// Layers, outside to inside:
//   .pit        the Emergence shake (the pit is the Ghost's placement)
//   .ghostPlace the Ghost_Box position, clipped at the Soil line
//   .ghost      the rise, from below the Soil to the risen pose (data-ghost-rise)
//   .bob        the Idle_Bob, and the held Envelope's slot (.heldSlot)
//   svg         the drawing, with the eyes group that follows the pointer

import type { CSSProperties, ReactNode, Ref } from "react";

import { EYE_TRANSITION_MS } from "../constants";
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

const NO_OFFSET: EyeOffset = { dx: 0, dy: 0 };

export type GhostProps = {
  /** The pose, set by the Stage. Defaults to the risen end pose. */
  pose?: GhostPose;
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
  /** The held Envelope, rendered in the bob's slot. */
  children?: ReactNode;
};

/**
 * The Ghost drawing. `children` render in the held slot, inside the bob, so an
 * Envelope held by the Ghost moves with it (R5.2).
 */
export function Ghost({
  pose = "risen",
  eyes = NO_OFFSET,
  gradientId = "ghost-body",
  leaving = false,
  riseRef,
  leaveVars,
  children,
}: GhostProps) {
  return (
    <div className={styles.pit} data-pose={pose} data-ghost-pit>
      <div className={styles.ghostPlace}>
        <div
          ref={riseRef}
          className={styles.ghost}
          data-pose={pose}
          data-leaving={leaving ? "true" : undefined}
          data-ghost-rise
          style={leaveVars}
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
