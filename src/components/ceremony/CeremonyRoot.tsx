"use client";

// Feature: 05-reveal-ceremony
//
// The Ceremony root (design.md "OpeningFlow changes", R3.1, R3.2, R9.6, R11.2,
// R15.1, R17.3). It replaces the OpeningFlow root `div` while keeping the same
// region contract — `role="region"`, `aria-label`, `tabIndex={-1}` and the
// focus-on-`state.tag` effect — and adds the Ceremony skin on top:
//
//  - `data-ceremony`: the current Stage, from `stageFor(state, localView)`.
//    The local view is the view-local animation state reported up through the
//    local-view context (design.md "Stage resolution"): `SealBreak` sets
//    `{ sealing: true }` while a break is in progress, so stage 1 resolves to
//    `seal` while sealing and `marks` otherwise, and the stage 3 sequence sets
//    `{ step }`. The provider's initial value is `DEFAULT_LOCAL_VIEW`, so the
//    server render and the FIRST client render report the final, settled local
//    view (design.md "Final state first"): a static stage-1 reveal reads
//    `marks` and a static stage-3 reveal reads `close`. A view only moves the
//    local view in an event handler or effect after mount, so hydration
//    matches.
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
// `full` motion (the real provider resolves the device mode in an effect) and
// the `DEFAULT_LOCAL_VIEW` local view (the running views move it only after
// mount), so the static markup this component emits is deterministic.
// `Math.random` and `Date.now` are never called in render, and this module
// imports no `@/lib/crypto` (the ceremony source scan enforces both).

import { useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { CEREMONY_COPY } from "./copy";
import { LiveRegion, LiveRegionProvider } from "./LiveRegion";
import { LocalViewProvider, useLocalView } from "./local-view";
import { useMotion, type MotionMode } from "./motion";
import { useSequence } from "./skip";
import { SoundToggle } from "./sound/SoundToggle";
import { SoundEnabledContext } from "./sound/SoundEnabledContext";
import { soundCues } from "./sound/cues";
import { StageContext } from "./stage-context";
import {
  emergingStatus,
  focusTargetFor,
  ghostHanded,
  shouldRescueFocus,
  stageFor,
  type Stage,
} from "./stages";
import { FOCUS_SCROLL_CHECK_MS, PICKUP_MOVE_MS } from "./constants";
import { personaStepFor, stepAnnouncement } from "./steps";
import { StepIndicator } from "../ui/StepIndicator";
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
  /**
   * Where the Calm and Skip controls render. `"region"` (the default, live
   * mode) renders them inside the region. `"topbar"` (persona mode) renders
   * neither, because the Top_Bar holds them (spec 07, R8.3).
   */
  controls?: "topbar" | "region";
  /** The one view for the current Stage, rendered inside the region. */
  children: ReactNode;
};

/**
 * The index of the Stage heading to focus, given the tag names of the region's
 * headings in document order. The newest Stage is the last heading, so the
 * index of the last `h1` or `h2`, or -1 when the region has none. Pure, so the
 * focus rule is testable without a DOM.
 */
export function stageHeadingIndex(tagNames: readonly string[]): number {
  for (let index = tagNames.length - 1; index >= 0; index -= 1) {
    const tag = tagNames[index];
    if (tag === "h1" || tag === "h2") return index;
  }
  return -1;
}

/**
 * The default focus rule (spec 07, R9.6): `[data-stage-focus]` when a view names
 * its own target, else the newest `h1`/`h2`, else the region itself. A view
 * without a heading (the envelope, the loading statement) takes the region.
 */
function focusStageDefault(region: HTMLElement): void {
  // A view can name its own focus target (spec 07 R11.2): the recall field.
  // It wins over the newest heading.
  const stageFocus = region.querySelector<HTMLElement>("[data-stage-focus]");
  if (stageFocus !== null) {
    stageFocus.focus();
    return;
  }
  const headings = Array.from(region.querySelectorAll<HTMLElement>("h1, h2"));
  const index = stageHeadingIndex(headings.map((heading) => heading.tagName.toLowerCase()));
  const target = index < 0 ? region : headings[index];
  if (target === undefined) return;
  if (target !== region && !target.hasAttribute("tabindex")) {
    target.tabIndex = -1;
  }
  target.focus();
}

/**
 * Focus the Figures_Heading after "See the numbers" or "Show everything" (spec 08,
 * R2.1 to R2.3). Focus moves with `preventScroll`, then the heading scrolls to
 * the top of the view. The scroll is `smooth` only in full motion without
 * reduced motion. One timer, `FOCUS_SCROLL_CHECK_MS` later, re-checks the
 * heading against the Top_Bar's bottom and the viewport's bottom and jumps once
 * with `auto` if it is hidden. The returned cleanup clears that timer, so the
 * next Stage change cancels it.
 */
function focusFiguresHeading(
  region: HTMLElement,
  mode: MotionMode,
): (() => void) | undefined {
  const heading = region.querySelector<HTMLElement>("[data-figures-heading]");
  if (heading === null) {
    focusStageDefault(region);
    return undefined;
  }
  heading.focus({ preventScroll: true });
  const reduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  heading.scrollIntoView({
    block: "start",
    behavior: mode === "full" && !reduced ? "smooth" : "auto",
  });
  const timer = setTimeout(() => {
    if (!heading.isConnected) return;
    const topBar = document.querySelector<HTMLElement>("[data-topbar]");
    const topBarBottom = topBar === null ? 0 : topBar.getBoundingClientRect().bottom;
    const top = heading.getBoundingClientRect().top;
    if (top < topBarBottom || top >= window.innerHeight) {
      heading.scrollIntoView({ block: "start", behavior: "auto" });
    }
  }, FOCUS_SCROLL_CHECK_MS);
  return () => clearTimeout(timer);
}

/**
 * The Ceremony root. Provides the local-view and live-region contexts to the
 * region and the views beneath it, then renders the region itself. The
 * local-view provider's initial value is `DEFAULT_LOCAL_VIEW`, so the first
 * render is the settled state and hydration matches (design.md "Final state
 * first"). The `LiveRegionProvider` gives a view deeper in the tree —
 * `SealBreak` — a working `useLiveRegion()` so it can announce the seal's
 * state; the per-Stage line is announced by the region itself (below).
 */
export function CeremonyRoot(props: CeremonyRootProps) {
  return (
    <LocalViewProvider>
      <LiveRegionProvider>
        <CeremonyRegion {...props} />
      </LiveRegionProvider>
    </LocalViewProvider>
  );
}

/**
 * The Ceremony root region. Derives the Stage from `stageFor(state, localView)`
 * and the motion mode, announces the Stage politely, and renders the Calm and
 * (when a sequence is active) Skip controls around the current view.
 */
function CeremonyRegion({
  state,
  personaName,
  className,
  controls = "region",
  children,
}: CeremonyRootProps) {
  const { mode, setCalm } = useMotion();
  const { hasActive, skipAll } = useSequence();
  const { localView } = useLocalView();

  // The sound toggle's state (R14.1). Off by default and in memory only. The
  // Seal_Break reads it through SoundEnabledContext below. The toggle itself
  // keeps its own copy, and both change on the same press.
  const [soundOn, setSoundOn] = useState(false);
  // On the persona page (`controls="topbar"`) the Top_Bar owns the sound state,
  // above this region (SceneShell). This region then passes that state down, so
  // the Seal_Break follows the Top_Bar toggle. Live pages (`region`) keep their own.
  const inheritedSound = useContext(SoundEnabledContext);

  // The Stage for the current state at the live local view (design.md "Stage
  // resolution"). On the server and first render `localView` is
  // `DEFAULT_LOCAL_VIEW`, so the static markup reports the settled Stage
  // (`marks` for a stage-1 reveal, `close` for stage 3); a running view moves
  // it after mount, so `data-ceremony` tracks `seal` while a break is in
  // progress, then settles.
  const stage = stageFor(state, localView);

  // `light` counts as `full` for the attribute: Stages still change by motion,
  // only lighter (R3.2). Only `calm` turns motion off.
  const motionAttr = mode === "calm" ? "calm" : "full";

  // The live line for this Stage (R3.1). One short, neutral sentence.
  // The emerging line is the same string the envelope shows (emergingStatus).
  // On the persona page (`topbar`), a Stage on a Step_Indicator step announces
  // that step instead (spec 09 C2.3), so the line changes once per step.
  const stepNow = controls === "topbar" ? personaStepFor(stage) : null;
  const liveLine =
    stepNow !== null
      ? stepAnnouncement(stepNow)
      : stage === "emerging"
        ? emergingStatus(state.tag)
        : CEREMONY_COPY.stageLive[stage];
  // The Step_Indicator shows from the first `recall` render to `close` on the
  // persona page (C2.1, spec 10 C1.7): a step is current in each of those Stages.
  const showSteps = controls === "topbar" && stepNow !== null;

  // Move focus when the view or the Stage changes (R9.6, R11, spec 08 focus
  // table). `focusTargetFor` reads the previous Stage and the next one:
  //  - figures-heading: the Figures_Heading, with a scroll and one re-check;
  //  - none: move nothing, except rescue focus when its element was removed
  //    in the same commit (`shouldRescueFocus`);
  //  - default: the spec 07 rule (`focusStageDefault`).
  // Runs after mount only, so server and first render match. The effect reads
  // the DOM only, and its cleanup clears the scroll re-check on the next Stage
  // change or on unmount.
  const regionRef = useRef<HTMLDivElement>(null);
  const previousStageRef = useRef<Stage | null>(null);
  // The motion mode is read by the focus effect without making the effect run
  // again on a Calm toggle (a toggle must not move focus).
  const motionRef = useRef(mode);
  useEffect(() => {
    motionRef.current = mode;
  }, [mode]);
  useEffect(() => {
    const prev = previousStageRef.current;
    previousStageRef.current = stage;
    const region = regionRef.current;
    if (region === null) return undefined;
    const target = focusTargetFor(prev, stage);
    if (target.kind === "figures-heading") {
      return focusFiguresHeading(region, motionRef.current);
    }
    if (target.kind === "none") {
      const active = document.activeElement;
      const activeIsBody = active === null || active === document.body;
      if (shouldRescueFocus(activeIsBody, target)) {
        region
          .querySelector<HTMLElement>("[data-figures-heading]")
          ?.focus({ preventScroll: true });
      }
      return undefined;
    }
    focusStageDefault(region);
    return undefined;
  }, [state.tag, stage]);

  // The dust ceiling depends on the backdrop's lift. Once the pick-up move has
  // finished, a resize tells the Soil_Canvas to read the ceiling again (its own
  // resize handler re-reads it, design.md "SceneBackdrop and the Soil", R6.16).
  const handed = ghostHanded(stage);
  useEffect(() => {
    if (!handed) return;
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, PICKUP_MOVE_MS);
    return () => clearTimeout(timer);
  }, [handed]);

  // The Calm control toggles motion off/on; its label flips with the mode.
  const calmLabel =
    motionAttr === "calm" ? CEREMONY_COPY.calmOff : CEREMONY_COPY.calmOn;

  // Both controls are desk-token buttons (R11.2, R1.7). `styles.desk` defines
  // the desk tokens on the button itself, because the scene's `.desk` root is
  // a sibling, not an ancestor. `styles.deskControl` then sets the surface and
  // border, and it is declared after `.desk` so it wins.
  const controlClass = `${styles.desk} ${styles.deskControl}`;

  // Calm and Skip render here only in `region` mode. In `topbar` mode the
  // Top_Bar renders them (spec 07, R8.3), so the page has one of each.
  const showRegionControls = controls === "region";

  return (
    <div
      ref={regionRef}
      tabIndex={-1}
      role="region"
      aria-label={personaName}
      data-ceremony={stage}
      data-ceremony-motion={motionAttr}
      className={`${styles.desk} ${className ? `${styles.ceremony} ${className}` : styles.ceremony}`}
    >
      <SoundEnabledContext.Provider value={showRegionControls ? soundOn : inheritedSound}>
        <StageContext.Provider value={stage}>
        <LiveRegion message={liveLine} />
        {showRegionControls ? (
          <button
            type="button"
            className={controlClass}
            onClick={() => setCalm(motionAttr !== "calm")}
          >
            {calmLabel}
          </button>
        ) : null}
        {/* The sound toggle and its note render in the region only. On the
            persona page (`topbar`) they do not belong to the pre-reveal Stages:
            design.md "Sound toggle placement" moves them into the `marks`
            column (spec 07 task 5). Rendering them here would also fill the
            narrow band above the Soil strip and push the status card onto it. */}
        {showRegionControls ? (
          <>
            <SoundToggle
              onChange={(next) => {
                setSoundOn(next);
                soundCues.onToggle(next);
              }}
            />
            <p className={`${styles.desk} ${styles.soundNote}`}>
              {CEREMONY_COPY.soundNote}
            </p>
          </>
        ) : null}
        {showRegionControls && hasActive ? (
          <button type="button" className={controlClass} onClick={skipAll}>
            {CEREMONY_COPY.skip}
          </button>
        ) : null}
        {showSteps ? (
          <StepIndicator
            steps={CEREMONY_COPY.steps}
            current={stepNow}
            label={CEREMONY_COPY.stepsLabel}
          />
        ) : null}
        <div data-stage-content>{children}</div>
        </StageContext.Provider>
      </SoundEnabledContext.Provider>
    </div>
  );
}
