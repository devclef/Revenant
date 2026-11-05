"use client";

// Feature: 07-judge-journey
//
// The persona Ghost (design.md "The Ghost", R5.5 to R5.8, R9.5 to R9.14,
// R12.6 to R12.10). This client wrapper owns everything that needs the
// browser or a provider: the Stage pose, the motion mode, the Skip sequence,
// the Emergence rise and the pointer eye follow. It renders the drawing in
// Ghost.tsx with the values it computes.
//
// The eye follow is client-only and adds its pointer listeners in an effect.
// The rise, shake and bob are CSS. The first render already shows the end
// pose, so the Ghost is correct with no motion at all.

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { EASE_LEAVE, GHOST_FADE_MS, GHOST_LEAVE_MS } from "../constants";
import { useMotion } from "../motion";
import { useMaybeSequence } from "../skip-optional";
import { ghostHanded } from "../stages";
import { useStage } from "../stage-context";
import { eyeOffset, followsPointer } from "./eyes";
import { EYE_CENTRE_SVG, VIEWBOX_HEIGHT, VIEWBOX_WIDTH, type EyeOffset } from "./ghost-geometry";
import { Ghost, type GhostPose } from "./Ghost";
import { useEmergence } from "./useEmergence";

const NO_OFFSET: EyeOffset = { dx: 0, dy: 0 };

/** The leave timings as CSS variables, from constants.ts (R12.6). */
const LEAVE_VARS = {
  "--ghost-leave-ms": `${GHOST_LEAVE_MS}ms`,
  "--ghost-fade-ms": `${GHOST_FADE_MS}ms`,
  "--ghost-leave-ease": EASE_LEAVE,
} as CSSProperties;

export type PersonaGhostProps = {
  /** The held Envelope, rendered in the bob's slot. */
  children?: ReactNode;
  /**
   * True while the Ghost leaves after a completed break (design.md "The
   * dissolve on break"). The rise and bob stop, and the Ghost moves up and
   * fades. The parent unmounts the Ghost after `GHOST_LEAVE_MS`.
   */
  leaving?: boolean;
  /**
   * Called when the leave ends early because Skip ran. The parent then
   * unmounts the Ghost at once, so Skip leaves no Ghost (R12.9).
   */
  onLeft?: () => void;
};

/** The persona Ghost: the drawing plus motion, Stage pose and eye follow. */
export function PersonaGhost({ children, leaving = false, onLeft }: PersonaGhostProps) {
  const { mode } = useMotion();
  const calm = mode === "calm";
  const sequence = useMaybeSequence();
  const register = sequence?.register;

  // Skip during the leave ends it at once. The registration lasts only while
  // the leave runs, so Skip never waits on a Ghost that is already gone.
  useEffect(() => {
    if (!leaving || register === undefined) return undefined;
    return register(() => onLeft?.());
  }, [leaving, onLeft, register]);

  const riseRef = useRef<HTMLDivElement>(null);
  const [pointerOffset, setPointerOffset] = useState<EyeOffset>(NO_OFFSET);
  const gradientId = `ghost-body-${useId().replace(/:/g, "")}`;

  useEmergence(riseRef);

  // Eye follow (R5.5 to R5.8). Mouse and pen move the eyes, rAF-throttled.
  // pointerleave on the document returns them to the centre. Calm attaches no
  // listener and shows the centre (the `eyes` value below).
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
        // The drawing's SVG is the element marked data-ghost-box inside the rise.
        const svg = riseRef.current?.querySelector<SVGSVGElement>("[data-ghost-box]");
        if (svg === null || svg === undefined || latest === null) return;
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
  const pose: GhostPose = ghostHanded(useStage()) ? "handed" : "risen";

  return (
    <Ghost
      pose={pose}
      eyes={eyes}
      gradientId={gradientId}
      leaving={leaving}
      riseRef={riseRef}
      leaveVars={LEAVE_VARS}
    >
      {children}
    </Ghost>
  );
}
