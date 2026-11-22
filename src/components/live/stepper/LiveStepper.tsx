"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { useCalmInForce } from "@/components/ceremony/motion";

import { LIVE_COPY } from "../copy";
import type { WriteDraft, WriteDraftEvent } from "../write-draft";

import styles from "./stepper.module.css";
import { StepTrack } from "./StepTrack";
import {
  LIVE_STEPS,
  LIVE_STEP_NAMES,
  canGoBack,
  hasPrimaryCard,
  movesFocus,
  stepIndex,
  stepName,
  stepperDrawsHeading,
  type LiveStep,
  type StepperAction,
  type StepperState,
} from "./live-steps";

/** What a step's content receives from the stepper. */
export interface StepView {
  step: LiveStep;
  /** The write draft, kept across steps until the seal is stored. */
  draft: WriteDraft;
  /** Applies one form event to the draft. */
  dispatchDraft: (event: WriteDraftEvent) => void;
  /** Moves to the next step. The step checks its own validity first. */
  next: () => void;
  /** Moves to the previous step. Does nothing where Back is not offered. */
  back: () => void;
  /** Whether Back is offered on this step. */
  canGoBack: boolean;
  /**
   * Moves forward to a later step (spec 09, D5.4). Used by the embedded
   * Opening_Flow when the reader reaches Testify or Receipts. It never moves
   * back and never moves the stepper on its own.
   */
  advanceTo: (step: LiveStep) => void;
  /**
   * The Reveal_Host, a sibling after the Primary_Card (spec 12, X1). The
   * embedded Opening_Flow is portalled into it. Null until the host mounts.
   */
  host: HTMLElement | null;
}

export interface LiveStepperProps {
  /**
   * The stepper state, owned by SealPage. The page is the single owner of the
   * letter draft, so Back keeps it between steps (spec 09 D2.2).
   */
  state: StepperState;
  /** Sends one stepper action to the page-owned state. */
  dispatch: (action: StepperAction) => void;
  /** Renders the content of the current step, including its fields and Next. */
  renderStep: (view: StepView) => ReactNode;
}

/**
 * The one-step-per-screen layout of /demo/live (spec 09 D2). It shows the
 * Step_Indicator and, for Write, Seal and Wait, one Primary_Card holding the
 * step's heading, its fields and its Next inside one `data-primary-control`
 * group. Testify and Receipts have no card. Below the card sits the
 * Reveal_Host, where the embedded Opening_Flow mounts (spec 12, X1). When the
 * step changes, focus moves to the new heading, if the step has one.
 */
export function LiveStepper({ state, dispatch, renderStep }: LiveStepperProps) {
  // The Step_Track wrapper. The step change scrolls this, not the heading, so
  // the track and the card both land below the Top_Bar (baseline 98d49aa, cause a).
  const trackRef = useRef<HTMLDivElement>(null);
  // The frame that will scroll the track. A newer step change cancels it, and
  // unmount cancels it too, so a stale frame never scrolls.
  const scrollFrame = useRef<number | null>(null);
  const primaryRef = useRef<HTMLDivElement>(null);
  // The Reveal_Host element. It is set once on mount and never changes, so the
  // portal target stays the same (spec 12, X1).
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  // Calm is on under reduced motion or the judge's Calm control. Calm scrolls
  // without animation.
  const calm = useCalmInForce();
  const previousStep = useRef<LiveStep>(state.step);

  useLayoutEffect(() => {
    // Skip the first render, so a page load does not steal focus.
    if (!movesFocus(previousStep.current, state.step)) return;
    previousStep.current = state.step;
    // Focus without the browser's own scroll. The scroll itself runs after one
    // frame, so the new step has its height first (baseline cause a). The
    // target is the step's [data-step-heading]: the h2 drawn for Wait here, or
    // the page's own heading for Write and Seal (spec 14).
    primaryRef.current
      ?.querySelector<HTMLElement>("[data-step-heading]")
      ?.focus({ preventScroll: true });
    if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = null;
      trackRef.current?.scrollIntoView({
        behavior: calm ? "instant" : "smooth",
        block: "start",
      });
    });
  }, [state.step, calm]);

  // Unmount cancels a pending scroll frame.
  useLayoutEffect(() => {
    return () => {
      if (scrollFrame.current !== null)
        cancelAnimationFrame(scrollFrame.current);
    };
  }, []);

  const view: StepView = {
    step: state.step,
    draft: state.draft,
    dispatchDraft: (event) => dispatch({ type: "DRAFT", event }),
    next: () => dispatch({ type: "NEXT" }),
    back: () => dispatch({ type: "BACK" }),
    canGoBack: canGoBack(state.step, state.sealed),
    advanceTo: (step) => dispatch({ type: "GOTO", step }),
    host,
  };

  // The section keeps its element type and position on every step, so the
  // content inside it (the Wait step with its flow) is not remounted when the
  // card drops away on Testify and Receipts.
  const card = hasPrimaryCard(state.step);

  return (
    <div className={styles.stepper} data-live-stepper>
      <div ref={trackRef} className={styles.track}>
        <StepTrack
          steps={LIVE_STEP_NAMES}
          current={stepIndex(state.step)}
          label={LIVE_COPY.stepsLabel}
          phoneTemplate={LIVE_COPY.stepTrackPhone}
        />
        {/* The one live region of the stepper (spec 14, S1.5). */}
        <p className={styles.announce} role="status" aria-live="polite">
          {LIVE_COPY.stepAnnounce
            .replace("{n}", String(stepIndex(state.step) + 1))
            .replace("{total}", String(LIVE_STEPS.length))
            .replace("{label}", stepName(state.step))}
        </p>
      </div>
      <section
        className={
          card
            ? state.step === "write"
              ? `${styles.card} ${styles.deskCard}`
              : styles.card
            : styles.bare
        }
        data-card={card ? "" : undefined}
        data-step={state.step}
      >
        <div
          ref={primaryRef}
          className={card ? styles.primary : styles.bareContent}
          data-primary-control={card ? "" : undefined}
        >
          {stepperDrawsHeading(state.step) ? (
            <h2 data-step-heading="" tabIndex={-1} className={styles.heading}>
              {stepName(state.step)}
            </h2>
          ) : null}
          {renderStep(view)}
        </div>
      </section>
      <div ref={setHost} className={styles.revealHost} data-reveal-host="" />
    </div>
  );
}
