"use client";

/**
 * The Opening_Flow view selector (design.md "Opening_Flow and Reveal",
 * Components table row `OpeningFlow.tsx`).
 *
 * This client component is the single seam between the effect runner
 * (`useOpeningFlow`) and the views. It calls the hook once, reads the current
 * `state.tag`, and renders exactly one view for that tag, handing each view the
 * slice of state and the handlers it needs. It holds no flow state of its own:
 * everything lives in the reducer, so this file stays a pure switch over
 * `state.tag`.
 *
 * View per tag (design.md state machine):
 * - `loading`            -> an inline "breaking the seal" statement.
 * - `sealed`             -> `StillSealed` (opening date + countdown, retry).
 * - `openable` /
 *   `verifying`          -> an inline "checking the seal" statement.
 * - `verified`           -> `SealIntact` (the seal-is-intact statement + Begin).
 * - `recall`             -> `RecallStep` (answer the sealed questions).
 * - `submitting` /
 *   `submit_failed`      -> `RecallStep`, with the submit control disabled while
 *                           posting (`submitting`) and the submit-failed notice
 *                           shown after a failed post (R8.7, R8.9).
 * - `reveal`             -> `Reveal` (the staged reveal, stage 1 onward).
 * - every error tag      -> `FlowError` with the matching kind.
 *
 * Focus (R9.6, accessibility): when the view changes, focus moves to the new
 * view's region so a keyboard or screen-reader user lands on the fresh content
 * instead of staying on a control that no longer exists. Each view is wrapped
 * in a `tabIndex={-1}` region labelled for the current step; the effect focuses
 * it whenever `state.tag` changes. `StillSealed` and `RecallStep` render their
 * own `<h1>`; the wrapper region is the reliable focus target for every view,
 * including the inline loading and verifying statements and the ones without a
 * heading element.
 *
 * Crypto boundary (R14.6): this module imports no `@/lib/crypto`, statically or
 * otherwise. Crypto is reached only through the dynamic `import()` inside
 * `useOpeningFlow`, so the demo route never pulls crypto into a static import
 * graph. The import-boundary test enforces this.
 *
 * Every string comes from the copy modules (R15.1); this component holds no
 * inline user-facing literal.
 */

import { useEffect, useRef } from "react";
import { ParchmentSurface } from "@/components/ui";
import { useOpeningFlow } from "./useOpeningFlow";
import { StillSealed } from "./StillSealed";
import { SealIntact } from "./SealIntact";
import { RecallStep } from "./RecallStep";
import { Reveal } from "./Reveal";
import { FlowError, type FlowErrorKind } from "./FlowError";
import type { FlowState, OpenFailedKind } from "./opening-machine";
import { REVEAL_COPY } from "./copy";
import styles from "./reveal.module.css";

export type OpeningFlowProps = {
  /**
   * The letter's public ID, taken only from the persona list. Passed straight
   * to `useOpeningFlow`, which uses it for every API call and as the recall
   * record's AAD. This component never reads it from the URL.
   */
  letterId: string;
  /** The persona's name, for the region's accessible label. */
  personaName: string;
};

/**
 * Map an `open_failed` reducer kind (snake_case) to the `FlowError` kind
 * (camelCase). Both enumerate the same failures; this is the only place the two
 * spellings meet, so a new kind must be added in both and here.
 */
const OPEN_FAILED_KIND: Record<OpenFailedKind, FlowErrorKind> = {
  wrong_key: "wrongKey",
  tampered: "tampered",
  unsupported_format: "unsupportedFormat",
  invalid_payload: "invalidPayload",
  invalid_input: "invalidInput",
};

export function OpeningFlow({ letterId, personaName }: OpeningFlowProps) {
  const flow = useOpeningFlow(letterId);
  const { state } = flow;

  // Move focus to the new view's region whenever the step changes (R9.6). The
  // region is a -1 tab stop, so this focuses it programmatically without adding
  // it to the normal tab order.
  const regionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    regionRef.current?.focus();
  }, [state.tag]);

  return (
    <div
      ref={regionRef}
      tabIndex={-1}
      role="region"
      aria-label={personaName}
      className={styles.flow}
    >
      <div className={styles.view}>{selectView(state, flow, personaName)}</div>
    </div>
  );
}

/** Render the one view that belongs to the current `state.tag`. */
function selectView(
  state: FlowState,
  flow: ReturnType<typeof useOpeningFlow>,
  personaName: string,
): React.ReactNode {
  switch (state.tag) {
    case "loading":
      return (
        <ParchmentSurface as="section" className={styles.sealed}>
          <h1>{REVEAL_COPY.loading}</h1>
        </ParchmentSurface>
      );

    case "sealed":
      return <StillSealed opensAt={state.opensAt} onRetry={flow.retry} />;

    case "openable":
    case "verifying":
      return (
        <ParchmentSurface as="section" className={styles.intact}>
          <h1>{REVEAL_COPY.verifying}</h1>
        </ParchmentSurface>
      );

    case "verified":
      return <SealIntact onBegin={flow.begin} />;

    case "recall":
      return (
        <RecallStep
          opened={state.opened}
          drafts={state.drafts}
          invalid={state.invalid}
          submitting={false}
          onEdit={flow.editDraft}
          onToggleNoAnswer={flow.toggleNoAnswer}
          onSubmit={flow.submit}
        />
      );

    case "submitting":
      return (
        <RecallStep
          opened={state.opened}
          drafts={state.drafts}
          invalid={[]}
          submitting={true}
          onEdit={flow.editDraft}
          onToggleNoAnswer={flow.toggleNoAnswer}
          onSubmit={flow.submit}
        />
      );

    case "submit_failed":
      return (
        <>
          <RecallStep
            opened={state.opened}
            drafts={state.drafts}
            invalid={[]}
            submitting={false}
            onEdit={flow.editDraft}
            onToggleNoAnswer={flow.toggleNoAnswer}
            onSubmit={flow.retryPost}
          />
          <p role="alert" className={styles.fieldError}>
            {REVEAL_COPY.submitFailed}
          </p>
        </>
      );

    case "reveal":
      return (
        <Reveal
          opened={state.opened}
          record={state.record}
          personaName={personaName}
          stage={state.stage}
          onAdvance={flow.advance}
          onShowAll={flow.showAll}
        />
      );

    case "not_placed":
      return <FlowError kind="notPlaced" onRetry={flow.retry} />;

    case "unreachable":
      return <FlowError kind="unreachable" onRetry={flow.retry} />;

    case "verification_failed":
      return <FlowError kind="verificationFailed" onRetry={flow.retry} />;

    case "open_failed":
      return (
        <FlowError kind={OPEN_FAILED_KIND[state.kind]} onRetry={flow.retry} />
      );

    default:
      // Exhaustiveness guard: a new tag must add a case above. This path is
      // unreachable for the FlowState union.
      return null;
  }
}
