"use client";

// Feature: 07-judge-journey
//
// The Ghost (design.md "The Ghost", R5.1 to R5.14, R9.5 to R9.7). One inline
// SVG drawn in this repository, recorded in ASSETS.md. It is the past self,
// not Kiro's logo or mascot. It has no hood, hands, arms or mouth.
//
// Layers, outside to inside:
//   .pit        the Emergence shake (the pit is the Ghost's placement)
//   .ghostPlace the Ghost_Box position, clipped at the Soil line
//   .ghost      the rise, from below the Soil to the risen pose
//   .bob        the Idle_Bob, and the held Envelope's slot (.heldSlot)
//   svg         the drawing, with the eyes group that follows the pointer
//
// The rise, shake and bob are CSS (scene.module.css). This component renders
// the end pose from the first render, so it is correct with no motion at all.
// The eye follow is client-only and adds its pointer listeners in an effect.

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { EYE_TRANSITION_MS } from "../constants";
import { useMotion } from "../motion";
import { ghostHanded } from "../stages";
import { useStage } from "../stage-context";
import { eyeOffset, followsPointer, type EyeOffset } from "./eyes";
import { useEmergence } from "./useEmergence";
import styles from "./scene.module.css";

/** The eyes sit at the midpoint of their centres, (100, 92) in SVG units. */
const EYE_CENTRE_SVG = { x: 100, y: 92 };
const VIEWBOX_HEIGHT = 240;
const VIEWBOX_WIDTH = 200;

/** The hem's zigzag, drawn after the head and body (design.md "The Ghost"). */
const BODY_PATH =
  "M34 104 A66 66 0 0 1 166 104 " +
  "C170 150 176 190 176 228 " +
  "L163 212 L150 230 L137 212 L124 230 L111 212 L100 230 " +
  "L89 212 L76 230 L63 212 L50 230 L37 212 L24 228 " +
  "C24 190 30 150 34 104 Z";

const FOLDS_PATH = "M58 150 L56 222 M142 150 L144 222";

const NO_OFFSET: EyeOffset = { dx: 0, dy: 0 };

/**
 * The Ghost. `children` render in the held slot, inside the bob, so an
 * Envelope held by the Ghost moves with it (R5.2).
 */
export function Ghost({ children }: { children?: ReactNode }) {
  const { mode } = useMotion();
  const calm = mode === "calm";

  const riseRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [pointerOffset, setPointerOffset] = useState<EyeOffset>(NO_OFFSET);
  const gradientId = `ghost-body-${useId().replace(/:/g, "")}`;

  useEmergence(riseRef);

  // Eye follow (R5.5 to R5.8). Mouse and pen move the eyes, rAF-throttled.
  // pointerleave on the document returns them to the centre. Calm attaches no
  // listener and shows the centre (the `shown` value below).
  useEffect(() => {
    if (calm) return;

    let frame = 0;
    let latest: { x: number; y: number } | null = null;

    const onMove = (event: PointerEvent) => {
      if (!followsPointer(event.pointerType, false)) return;
      latest = { x: event.clientX, y: event.clientY };
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const svg = svgRef.current;
        if (svg === null || latest === null) return;
        const box = svg.getBoundingClientRect();
        const centre = {
          x: box.left + (box.width * EYE_CENTRE_SVG.x) / VIEWBOX_WIDTH,
          y: box.top + (box.height * EYE_CENTRE_SVG.y) / VIEWBOX_HEIGHT,
        };
        setPointerOffset(eyeOffset(latest, centre));
      });
    };

    const onLeave = () => {
      setPointerOffset(NO_OFFSET);
    };

    const root = document.documentElement;
    document.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    return () => {
      document.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [calm]);

  // In Calm the eyes show the centre whatever the last pointer offset was.
  const eyes = calm ? NO_OFFSET : pointerOffset;
  // The pose is set by the Stage, never by the placement. Only the vertical
  // lift changes; the classes and horizontal values stay the same.
  const pose = ghostHanded(useStage()) ? "handed" : "risen";

  return (
    <div className={styles.pit} data-pose={pose} data-ghost-pit>
      <div className={styles.ghostPlace}>
        <div ref={riseRef} className={styles.ghost} data-pose={pose}>
          <div className={styles.bob}>
            <div className={styles.ghostGlow}>
              <svg
                ref={svgRef}
                className={styles.ghostSvg}
                viewBox={`0 0 ${VIEWBOX_WIDTH} 240`}
                aria-hidden="true"
                focusable="false"
                data-ghost-box
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" style={{ stopColor: "var(--ghost-top)" }} />
                    <stop
                      offset="0.45"
                      style={{ stopColor: "var(--ghost-mid)" }}
                    />
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
                  <ellipse
                    cx="78"
                    cy="92"
                    rx="11"
                    ry="16"
                    className={styles.ghostEye}
                  />
                  <ellipse
                    cx="122"
                    cy="92"
                    rx="11"
                    ry="16"
                    className={styles.ghostEye}
                  />
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
