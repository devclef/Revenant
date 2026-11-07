"use client";

import { useEffect, useReducer, useRef, type ReactNode } from "react";

import { useCalmInForce } from "@/components/ceremony/motion";
import { useKeepInVisualViewport } from "@/components/ui/use-keep-in-visual-viewport";

import type { WriteDraft, WriteDraftEvent } from "../write-draft";

import styles from "./stepper.module.css";
import { StepIndicator } from "./StepIndicator";
import {
  canGoBack,
  initialStepperState,
  movesFocus,
  reduceStepper,
  stepName,
  type LiveStep,
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
   * Call once the seal is stored. It drops the draft from state and removes
   * Back for good (spec 09 D2.3).
   */
  markSealed: () => void;
}

export interface LiveStepperProps {
  /** Renders the content of the current step, including its fields and Next. */
  renderStep: (view: StepView) => ReactNode;
  /** The step to start on. Defaults to Write. */
  initialStep?: LiveStep;
}

/**
 * The one-step-per-screen layout of /demo/live (spec 09 D2). It shows the
 * Step_Indicator and one card for the current step. Each card holds the step's
 * heading, its fields and its Next inside one `data-primary-control` group.
 * When the step changes, focus moves to the new heading.
 */
export function LiveStepper({
  renderStep,
  initialStep = "write",
}: LiveStepperProps) {
  const [state, dispatch] = useReducer(
    reduceStepper,
    initialStep,
    initialStepperState,
  );
  const headingRef = useRef<HTMLHeadingElement>(null);
  const primaryRef = useRef<HTMLDivElement>(null);
  // Keeps the focused field and its Next above the on-screen keyboard (P9).
  useKeepInVisualViewport(primaryRef, useCalmInForce());
  const previousStep = useRef<LiveStep>(state.step);

  useEffect(() => {
    // Skip the first render, so a page load does not steal focus.
    if (!movesFocus(previousStep.current, state.step)) return;
    previousStep.current = state.step;
    headingRef.current?.focus();
  }, [state.step]);

  const view: StepView = {
    step: state.step,
    draft: state.draft,
    dispatchDraft: (event) => dispatch({ type: "DRAFT", event }),
    next: () => dispatch({ type: "NEXT" }),
    back: () => dispatch({ type: "BACK" }),
    canGoBack: canGoBack(state.step, state.sealed),
    markSealed: () => {
      dispatch({ type: "SEALED" });
      // The seal step hands over to Wait once the seal is stored. Any other
      // step only records the seal.
      if (state.step === "seal") dispatch({ type: "NEXT" });
    },
  };

  return (
    <div className={styles.stepper} data-live-stepper>
      <StepIndicator current={state.step} />
      <section className={styles.card} data-card data-step={state.step}>
        <div ref={primaryRef} className={styles.primary} data-primary-control>
          <h2 ref={headingRef} tabIndex={-1} className={styles.heading}>
            {stepName(state.step)}
          </h2>
          {renderStep(view)}
        </div>
      </section>
    </div>
  );
}
