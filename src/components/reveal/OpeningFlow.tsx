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
 * - `loading` /
 *   `sealed` /
 *   `openable` /
 *   `verifying` /
 *   `verified`           -> `EnvelopeView` (design.md "Envelope and seal"): the
 *                           envelope Stage carries the "Bringing the letter into
 *                           the light." statement (`loading`), the still-sealed
 *                           opening date and countdown (`sealed`), the "Checking
 *                           the seal." statement (`openable` / `verifying`), and
 *                           the intact Stage with the seal-is-intact statement
 *                           and Begin (`verified`). The persona list fields feed
 *                           the envelope's dates and seal pattern; with no
 *                           persona the envelope uses its default pattern and
 *                           shows no dates (spec 03 renders).
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
 * instead of staying on a control that no longer exists. The region is now
 * `CeremonyRoot` (design.md "OpeningFlow changes"): it keeps the same
 * `tabIndex={-1}`, `role="region"` and `aria-label` as the old plain root
 * `div`, owns the focus-on-`state.tag` effect, and additionally carries
 * `data-ceremony` (the Stage) and `data-ceremony-motion` (`full` or `calm`),
 * announcing each new Stage in a polite live region. `StillSealed` and
 * `RecallStep` render their own `<h1>`; the wrapper region is the reliable
 * focus target for every view, including the inline loading and verifying
 * statements and the ones without a heading element.
 *
 * Motion and skip contexts (design.md "Final state first"): the tree is wrapped
 * in `MotionProvider` and `SkipProvider` so `useMotion` and `useSequence`
 * resolve inside `CeremonyRoot` and the views. The providers resolve `full`
 * motion and no active sequence on the server and first render, so the static
 * render is unchanged.
 *
 * Crypto boundary (R14.6): this module imports no `@/lib/crypto`, statically or
 * otherwise. Crypto is reached only through the dynamic `import()` inside
 * `useOpeningFlow`, so the demo route never pulls crypto into a static import
 * graph. The import-boundary test enforces this.
 *
 * Every string comes from the copy modules (R15.1); this component holds no
 * inline user-facing literal.
 */

import { CeremonyRoot } from "@/components/ceremony/CeremonyRoot";
import { MotionProvider } from "@/components/ceremony/motion";
import { SkipProvider } from "@/components/ceremony/skip";
import {
  EnvelopeView,
  type EnvelopeViewVariant,
} from "@/components/ceremony/envelope/EnvelopeView";
import type { EnvelopePersona } from "@/components/ceremony/envelope/Envelope";
import { useOpeningFlow } from "./useOpeningFlow";
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
   * record's AAD. This component never reads it from the URL (R16.5).
   */
  letterId: string;
  /** The persona's name, for the region's accessible label. */
  personaName: string;
  /**
   * List fields for the envelope (R3.7) and the seal pattern (R8.4). Optional,
   * so the spec 03 tests render as before. It feeds the scene only; it never
   * supplies the letter id, which always comes from `letterId` (R16.5).
   */
  persona?: { key: string; written_as_of: string; opens_at: string };
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

export function OpeningFlow({
  letterId,
  personaName,
  persona,
}: OpeningFlowProps) {
  const flow = useOpeningFlow(letterId);
  const { state } = flow;

  // The root is `CeremonyRoot`: it keeps the region role, the persona label and
  // the -1 tab stop, owns the focus-on-`state.tag` effect, and derives
  // `data-ceremony` / `data-ceremony-motion` plus the live-region announcement
  // from the current flow state. `MotionProvider` and `SkipProvider` wrap it so
  // `useMotion` and `useSequence` resolve for the root and the views; both
  // resolve `full` motion and no active sequence on the server and first
  // render, so the static markup is unchanged (design.md "Final state first").
  return (
    <MotionProvider>
      <SkipProvider>
        <CeremonyRoot
          state={state}
          personaName={personaName}
          persona={persona}
          className={styles.flow}
        >
          <div className={styles.view}>
            {selectView(state, flow, personaName, persona)}
          </div>
        </CeremonyRoot>
      </SkipProvider>
    </MotionProvider>
  );
}

/** Render the one view that belongs to the current `state.tag`. */
function selectView(
  state: FlowState,
  flow: ReturnType<typeof useOpeningFlow>,
  personaName: string,
  persona?: OpeningFlowProps["persona"],
): React.ReactNode {
  // The envelope's per-letter inputs: the persona list fields plus the demo
  // flag. These are always demo persona letters, so `demo` is true whenever a
  // persona is present. With no persona (spec 03 renders) the envelope falls
  // back to its default seal pattern and shows no dates (R3.7). The seal
  // patternKey is seeded from `persona.key` inside the Envelope/WaxSeal (R8.4).
  const envelopePersona: EnvelopePersona | undefined =
    persona === undefined ? undefined : { ...persona, demo: true };

  /** Render the shared EnvelopeView for one of the envelope-group variants. */
  const envelopeView = (variant: EnvelopeViewVariant): React.ReactNode => (
    <EnvelopeView
      variant={variant}
      persona={envelopePersona}
      onBegin={flow.begin}
      onRetry={flow.retry}
    />
  );

  switch (state.tag) {
    case "loading":
      return envelopeView("loading");

    case "sealed":
      // The still-sealed opening date and countdown come from EnvelopeView's
      // reused StillSealed, which reads them from the persona list field
      // `opens_at` (the same letter's opening instant the server released).
      // With no persona (spec 03 renders) the closed envelope stands alone.
      return envelopeView("sealed");

    case "openable":
      // `openable` is a brief transition into checking the seal; it shows the
      // same "Checking the seal." scene as `verifying`.
      return envelopeView("verifying");

    case "verifying":
      return envelopeView("verifying");

    case "verified":
      return envelopeView("verified");

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
