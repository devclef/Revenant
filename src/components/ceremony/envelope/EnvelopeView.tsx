"use client";

// Feature: 05-reveal-ceremony
//
// EnvelopeView: the Stage wrapper around the <Envelope> for the opening flow
// before the letter is revealed (design.md "Envelope and seal", state machine
// row `EnvelopeView: loading / sealed / openable / verifying / verified`).
//
// It renders exactly one scene for the flow tag it is given, drawing the
// envelope at the one fixed resting geometry `ENVELOPE_TARGET` (R8.7) so the
// first paint on the persona page matches the last frame of the /demo camera
// move. One component owns every pre-reveal envelope scene:
//
//   - `loading` / `openable` / `verifying`  the envelope Stage. The envelope
//     rests closed on the desk; a short statement sits beside it. On
//     `verifying` that statement ("Checking the seal.", REVEAL_COPY.verifying)
//     is announced in a `role="status"` region so a screen-reader reader hears
//     the seal is being checked. `loading` shows REVEAL_COPY.loading the same
//     way.
//   - `sealed`  the still-sealed variant: the opening date, the time remaining,
//     and a "Try again" control once the countdown reaches zero. Nothing about
//     the contents (R7.2). It REUSES the existing `StillSealed` view from
//     reveal/, which already owns the countdown wording and its display-only
//     clock, drawn inside the envelope's front panel. The clock lives in
//     `StillSealed` (reveal/), never in this ceremony module, so the ceremony
//     render stays deterministic (Property 21: no Date.now in ceremony render).
//   - `verified`  the intact Stage: the "seal is intact" statement
//     (REVEAL_COPY.sealIntact) shown BEFORE any recall question, and the
//     control that sends BEGIN (REVEAL_COPY.begin). The envelope turns over
//     (`closed` -> `turned` / `open`) only after BEGIN is sent, so the view
//     holds the envelope `closed` here; the later Stages drive the turn.
//
// R3.6 / R3.7: the envelope's size, folds and markup never read the letter. Its
// only per-letter inputs are the persona list fields (two dates and the demo
// flag) and the seal pattern key. With no persona it shows no dates and the
// Envelope falls back to one fixed default seal pattern key, so the spec 03
// renders are unchanged.
//
// R15.1: every user-facing string comes from a copy module (REVEAL_COPY here,
// and StillSealed's own strings also come from reveal/copy.ts). This component
// holds no inline literal copy.
//
// Property 21: this module calls no `Math.random` and no `Date.now` in render.
// The only clock is StillSealed's display-only countdown, which lives in the
// reveal tree, not here.

import type { ReactElement } from "react";

import { ParchmentSurface } from "@/components/ui";

import { REVEAL_COPY } from "@/components/reveal/copy";
import { StillSealed } from "@/components/reveal/StillSealed";
import { ENVELOPE_TARGET } from "../constants";
import { Envelope, type EnvelopePersona, type EnvelopeState } from "./Envelope";
import styles from "./EnvelopeView.module.css";

/**
 * Which pre-reveal scene to show. These are exactly the flow tags the design's
 * state machine routes to EnvelopeView; the mapping from `FlowState.tag` to one
 * of these lives in the caller (OpeningFlow).
 */
export type EnvelopeViewVariant =
  | "loading"
  | "openable"
  | "verifying"
  | "sealed"
  | "verified";

export type EnvelopeViewProps = {
  /** Which pre-reveal scene to render. */
  variant: EnvelopeViewVariant;
  /**
   * The persona list fields that feed the envelope's dates and seal pattern.
   * Optional: with no persona the envelope uses its default pattern key and
   * shows no dates (spec 03 renders).
   */
  persona?: EnvelopePersona;
  /**
   * The envelope face to draw. The envelope rests `closed` through every
   * pre-reveal Stage; it turns over only after BEGIN is sent, which the later
   * Stages drive. Defaults to `closed`.
   */
  envelopeState?: EnvelopeState;
  /** Sends BEGIN, moving from the intact statement to the recall step. */
  onBegin?: () => void;
  /** Sends START (retry) once the still-sealed countdown reaches zero. */
  onRetry?: () => void;
};

/**
 * The envelope's resting frame, drawn at exactly ENVELOPE_TARGET (R8.7). The
 * frame fixes the width and the top offset from the shared constants; the
 * Envelope keeps its own aspect ratio, so the SVG scales without distortion.
 */
function EnvelopeFrame({
  state,
  persona,
}: {
  state: EnvelopeState;
  persona?: EnvelopePersona;
}): ReactElement {
  return (
    <div
      className={styles.frame}
      style={{
        width: ENVELOPE_TARGET.width,
        marginTop: ENVELOPE_TARGET.top,
      }}
    >
      <Envelope state={state} persona={persona} />
    </div>
  );
}

/**
 * EnvelopeView renders one pre-reveal scene for its `variant`, always drawing
 * the envelope at ENVELOPE_TARGET. The statement variants put a short line
 * beside the envelope (the verifying/loading line in a polite `role="status"`
 * region); `sealed` shows the reused StillSealed view; `verified` shows the
 * seal-is-intact statement and the Begin control.
 */
export function EnvelopeView({
  variant,
  persona,
  envelopeState = "closed",
  onBegin,
  onRetry,
}: EnvelopeViewProps): ReactElement {
  switch (variant) {
    case "loading":
    case "openable":
    case "verifying": {
      // The envelope rests closed; a short statement sits beside it. On
      // `verifying` and `loading` the line is announced politely in a
      // `role="status"` region so a screen-reader reader hears it. `openable`
      // is a brief transition with no statement of its own.
      const statement =
        variant === "verifying"
          ? REVEAL_COPY.verifying
          : variant === "loading"
            ? REVEAL_COPY.loading
            : undefined;
      return (
        <ParchmentSurface as="section" className={styles.envelopeStage}>
          <EnvelopeFrame state="closed" persona={persona} />
          {statement === undefined ? null : (
            <p className={styles.statement} role="status">
              {statement}
            </p>
          )}
        </ParchmentSurface>
      );
    }

    case "sealed":
      // Still-sealed: the opening date and countdown, nothing about contents
      // (R7.2). Reuse StillSealed (reveal/) inside the envelope's front panel so
      // the wording and the display-only clock live in one place, outside the
      // ceremony render (Property 21). With no persona there is no opening date,
      // so the closed envelope stands alone. The real flow always has a persona.
      return (
        <ParchmentSurface as="section" className={styles.envelopeStage}>
          <EnvelopeFrame state="closed" persona={persona} />
          {persona === undefined ? null : (
            <div className={styles.panel}>
              <StillSealed
                opensAt={persona.opens_at}
                onRetry={onRetry ?? (() => {})}
              />
            </div>
          )}
        </ParchmentSurface>
      );

    case "verified":
      // The seal-is-intact statement, shown BEFORE any recall question, and the
      // control that sends BEGIN. The envelope stays closed; it turns over only
      // after BEGIN (R7.5, product.md "Recall first").
      return (
        <ParchmentSurface as="section" className={styles.intactStage}>
          <EnvelopeFrame state={envelopeState} persona={persona} />
          <p className={styles.statement}>{REVEAL_COPY.sealIntact}</p>
          <button type="button" className={styles.button} onClick={onBegin}>
            {REVEAL_COPY.begin}
          </button>
        </ParchmentSurface>
      );
  }
}
