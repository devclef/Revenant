"use client";

// Feature: 05-reveal-ceremony
//
// The Ceremony root (design.md "OpeningFlow changes", R3.1, R3.2, R9.6, R11.2,
// R15.1, R17.3). It replaces the OpeningFlow root `div` while keeping the same
// region contract — `role="region"`, `aria-label`, `tabIndex={-1}` and the
// focus-on-`state.tag` effect — and adds the Ceremony skin on top:
//
//  - `data-ceremony`: the current Stage, from `stageFor(state, DEFAULT_LOCAL_VIEW)`.
//    A static render reports the final, settled local view (design.md "Final
//    state first"), so reveal stage 3 reads `close`.
//  - `data-ceremony-motion`: `calm` when the motion mode is `calm`, else `full`.
//    Low-power (`light`) counts as `full`, because Stages still change by
//    motion, only lighter (design.md "Motion modes", R3.2).
//  - a polite live region (LiveRegion) that announces one short line per Stage
//    from `CEREMONY_COPY.stageLive`, so a reader who cannot see the motion is
//    still told where the Ceremony is (R3.1).
//  - the Calm control (R11.2): one button labelled from `CEREMONY_COPY`, which
//    toggles `useMotion().setCalm`. It is always present so motion can be
//    turned off (and back on).
//  - the Skip control (Property 19): shown only while at least one sequence is
//    registered (`useSequence().hasActive`); pressing it ends every sequence.
//
// Focus (R9.6): the region is a -1 tab stop; a layout effect moves focus to it
// whenever `state.tag` changes, so a keyboard or screen-reader user lands on
// the fresh content. The effect runs after mount only, so the server and first
// client render are identical (no hydration mismatch).
//
// Final state first (R17.3): the server and first client render always report
// `full` motion (the real provider resolves the device mode in an effect), so
// the static markup this component emits is deterministic. `Math.random` and
// `Date.now` are never called in render, and this module imports no
// `@/lib/crypto` (the ceremony source scan enforces both).

import { useEffect, useRef, type ReactNode } from "react";

import { CEREMONY_COPY } from "./copy";
import { LiveRegion } from "./LiveRegion";
import { useMotion } from "./motion";
import { useSequence } from "./skip";
import { DEFAULT_LOCAL_VIEW, stageFor } from "./stages";
import type { FlowState } from "../reveal/opening-machine";
import styles from "./ceremony.module.css";

export type CeremonyRootProps = {
  /** The current Opening_Flow state, used to derive the Stage and the live line. */
  state: FlowState;
  /** The persona's name, used as the region's accessible label. */
  personaName: string;
  /**
   * List fields for the envelope and seal pattern. Optional and unused by the
   * root itself (the scene reads them); accepted here so OpeningFlow can pass
   * the same prop through without the root needing to know the shape.
   */
  persona?: { key: string; written_as_of: string; opens_at: string };
  /** Extra class for the region (the reveal layout class). */
  className?: string;
  /** The one view for the current Stage, rendered inside the region. */
  children: ReactNode;
};

/**
 * The Ceremony root region. Derives the Stage and motion mode, announces the
 * Stage politely, and renders the Calm and (when a sequence is active) Skip
 * controls around the current view.
 */
export function CeremonyRoot({
  state,
  personaName,
  className,
  children,
}: CeremonyRootProps) {
  const { mode, setCalm } = useMotion();
  const { hasActive, skipAll } = useSequence();

  // The Stage for the current state, at the settled default local view
  // (design.md "Final state first"). The root reports the Stage; the running
  // views report their live local view through the skip/motion contexts.
  const stage = stageFor(state, DEFAULT_LOCAL_VIEW);

  // `light` counts as `full` for the attribute: Stages still change by motion,
  // only lighter (R3.2). Only `calm` turns motion off.
  const motionAttr = mode === "calm" ? "calm" : "full";

  // The live line for this Stage (R3.1). One short, neutral sentence.
  const liveLine = CEREMONY_COPY.stageLive[stage];

  // Move focus to the region whenever the step changes (R9.6). The region is a
  // -1 tab stop, so this focuses it programmatically without adding it to the
  // normal tab order. Runs after mount only, so server and first render match.
  const regionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    regionRef.current?.focus();
  }, [state.tag]);

  // The Calm control toggles motion off/on; its label flips with the mode.
  const calmLabel =
    motionAttr === "calm" ? CEREMONY_COPY.calmOff : CEREMONY_COPY.calmOn;

  return (
    <div
      ref={regionRef}
      tabIndex={-1}
      role="region"
      aria-label={personaName}
      data-ceremony={stage}
      data-ceremony-motion={motionAttr}
      className={className ? `${styles.ceremony} ${className}` : styles.ceremony}
    >
      <LiveRegion message={liveLine} />
      <button type="button" onClick={() => setCalm(motionAttr !== "calm")}>
        {calmLabel}
      </button>
      {hasActive ? (
        <button type="button" onClick={skipAll}>
          {CEREMONY_COPY.skip}
        </button>
      ) : null}
      {children}
    </div>
  );
}
