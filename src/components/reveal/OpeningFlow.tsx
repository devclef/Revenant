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
 * Focus (R9.6, accessibility): when the view or the Stage changes, focus moves
 * to the newest Stage heading (`<h1>`/`<h2>`) in the region, so a keyboard or
 * screen-reader user lands on the fresh content instead of a control that no
 * longer exists. A view with no heading (the loading and verifying statements,
 * the envelope) takes focus on the region itself. The region is `CeremonyRoot`
 * (design.md "OpeningFlow changes"): it keeps the same `tabIndex={-1}`,
 * `role="region"` and `aria-label` as the old plain root `div`, owns the focus
 * effect, and additionally carries `data-ceremony` (the Stage) and
 * `data-ceremony-motion` (`full` or `calm`), announcing each new Stage in a
 * polite live region.
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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ghost } from "@/components/ceremony/scene/Ghost";
import { SceneBackdrop } from "@/components/ceremony/scene/SceneBackdrop";
import { ghostPresent } from "@/components/ceremony/scene/ghost-presence";
import { GHOST_LEAVE_MS } from "@/components/ceremony/constants";
import { CeremonyRoot } from "@/components/ceremony/CeremonyRoot";
import { MotionProvider } from "@/components/ceremony/motion";
import { SkipProvider } from "@/components/ceremony/skip";
import {
  EnvelopeView,
  type EnvelopeViewProps,
  type EnvelopeViewVariant,
} from "@/components/ceremony/envelope/EnvelopeView";
import type { EnvelopePersona } from "@/components/ceremony/envelope/Envelope";
import { Envelope } from "@/components/ceremony/envelope/Envelope";
import heldStyles from "@/components/ceremony/scene/scene.module.css";
import { useSealBreak, type SealController } from "@/components/ceremony/seal/useSealBreak";
import { DemoLabel } from "@/components/demo/DemoLabel";
import { useOpeningFlow } from "./useOpeningFlow";
import { onceOnly, type AuthenticatorPort } from "@/components/live/unlock";
import { RecallStep } from "./RecallStep";
import { Reveal } from "./Reveal";
import { FlowError, type FlowErrorKind } from "./FlowError";
import type { FlowState, OpenFailedKind } from "./opening-machine";
import { createBeginGuard } from "./begin-guard";
import styles from "./reveal.module.css";

/**
 * The Envelope held in the Ghost's slot on the persona page (design.md "The
 * Envelope": it sits in the Ghost's held slot through `emerging`, `sealed`,
 * `intact`, `recall`, `marks` and `seal`, and never moves to the content
 * column, R10.13). It rests `closed` through the pre-reveal Stages; the later
 * Stages (task 4+) drive it to `turned`/`open`. It carries the persona's two
 * date lines so they stay readable above the dirt band (R8.8) and are never
 * clipped by the content column (the C2 fix).
 */
function HeldEnvelope({
  persona,
  tag,
}: {
  persona: EnvelopePersona;
  tag: FlowState["tag"];
}) {
  // The envelope is not held while the reader is away from the pre-reveal and
  // reveal Stages (submitting the recall, a failed open). Those Stages show no
  // Ghost envelope.
  const held = new Set<FlowState["tag"]>([
    "loading",
    "openable",
    "verifying",
    "awaiting_key",
    "unlocking",
    "sealed",
    "verified",
  ]);
  if (!held.has(tag)) return null;
  return (
    <div className={heldStyles.heldEnvelope}>
      <Envelope state="closed" layout="responsive" persona={persona} />
    </div>
  );
}

/** The key step's component type, from its own module. */
type KeyStepComponent = typeof import("@/components/live/UnlockView").UnlockView;

/**
 * Load the key step on demand. Only live letters reach `awaiting_key`, so the
 * chunk stays out of the persona route's first-load JavaScript (its 175 kB
 * budget). A plain `import()` is used rather than `next/dynamic`, which would
 * add its own runtime to every demo page.
 */
function useKeyStep(awaitingKey: boolean): KeyStepComponent | null {
  const [keyStep, setKeyStep] = useState<KeyStepComponent | null>(null);
  useEffect(() => {
    if (!awaitingKey || keyStep !== null) return;
    let cancelled = false;
    void import("@/components/live/UnlockView").then(
      (mod) => {
        if (!cancelled) setKeyStep(() => mod.UnlockView);
      },
      () => {
        // A failed load leaves the key step hidden. No secret is involved.
      },
    );
    return () => {
      cancelled = true;
    };
  }, [awaitingKey, keyStep]);
  return keyStep;
}

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
  /**
   * `"persona"` (default) is the demo persona route: the fixed demo key and no
   * passkey control. `"live"` is a Live_Letter: the reader unlocks with a
   * passkey or a backup key (spec 06, R17).
   */
  mode?: "persona" | "live";
  /** Live mode only: the authenticator port. Defaults to the browser's. */
  port?: AuthenticatorPort;
  /**
   * Live mode only: the backup key read from the `#k=` fragment. It pre-fills
   * the key field. The reader still submits it by hand (R21.6).
   */
  initialBackupKey?: string;
  /**
   * Persona mode only: the Demo_2_On boolean the persona page computes from
   * RP_ID at request time (design.md "Demo_2_On plumbing"). Only this boolean
   * reaches the client; RP_ID itself never does (R15.9). Default false.
   */
  demo2On?: boolean;
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
  mode = "persona",
  port,
  initialBackupKey,
  demo2On = false,
}: OpeningFlowProps) {
  // Live mode reads the key from the reader (keySource "user"). Persona mode
  // passes no options, so the hook behaves exactly as before.
  const flow = useOpeningFlow(
    letterId,
    mode === "live" ? { keySource: "user", port } : undefined,
  );
  const { state, retry } = flow;
  const KeyStep = useKeyStep(state.tag === "awaiting_key");

  // True from a completed full-motion break until the Ghost has left (R12.6).
  // Calm, Skip and Show everything never set it, so the Ghost unmounts in the
  // same render as their ADVANCE or SHOW_ALL.
  const [ghostLeaving, setGhostLeaving] = useState(false);
  useEffect(() => {
    if (!ghostLeaving) return undefined;
    const timer = setTimeout(() => setGhostLeaving(false), GHOST_LEAVE_MS);
    return () => clearTimeout(timer);
  }, [ghostLeaving]);
  const leftGhost = useCallback(() => setGhostLeaving(false), []);

  // The break's ADVANCE. `animated` is true only for a full-motion break, which
  // starts the Ghost's leave before the reveal stage moves on.
  const { advance } = flow;
  const onBreakAdvance = useCallback(
    (animated: boolean) => {
      if (animated) setGhostLeaving(true);
      advance();
    },
    [advance],
  );

  // The Seal_Break controller (task 5). Called once here, in reveal stage 1, and
  // passed to Reveal's SealBreak. Its ADVANCE and SHOW_ALL go through the flow.
  const seal = useSealBreak({ onAdvance: onBreakAdvance, onShowAll: flow.showAll });

  // The Pick_Up_Button sends BEGIN once per `verified` (R10.6). The latest
  // `begin` is read through a ref, so the guard keeps its state across renders.
  const latestBegin = useRef(flow.begin);
  useEffect(() => {
    latestBegin.current = flow.begin;
  }, [flow.begin]);
  const [beginGuard] = useState(() => createBeginGuard(() => latestBegin.current()));
  useEffect(() => {
    if (state.tag !== "verified") beginGuard.reset();
  }, [state.tag, beginGuard]);
  // The typed backup key lives here, not in the key step, so it survives the
  // `unlocking` view (which unmounts the key step) and a wrong-key return to
  // `awaiting_key` shows the same text again.
  const [keyText, setKeyText] = useState(initialBackupKey ?? "");

  // The still-sealed countdown reaches zero once per page load: one automatic
  // re-check (R17.4). `onceOnly` makes the second zero a no-op; the view then
  // shows "Try again" (StillSealed). The memo keeps the guard for this mount.
  const retryAtZero = useMemo(() => onceOnly(retry), [retry]);

  // The root is `CeremonyRoot`: it keeps the region role, the persona label and
  // the -1 tab stop, owns the focus effect (the Stage heading), and derives
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
          className={mode === "persona" ? `${styles.flow} ${styles.flowPersona}` : styles.flow}
          controls={mode === "persona" ? "topbar" : "region"}
        >
          {flow.live?.demo === true ? <DemoLabel /> : null}
          {mode === "persona" ? (
            <SceneBackdrop
              dimmed={state.tag === "reveal" && state.stage >= 2}
              animateDim={ghostLeaving}
            >
              {ghostPresent({
                tag: state.tag,
                stage: state.tag === "reveal" ? state.stage : null,
                leaving: ghostLeaving,
              }) ? (
                <Ghost leaving={ghostLeaving} onLeft={leftGhost}>
                  {persona === undefined ? null : (
                    <HeldEnvelope
                      persona={{ ...persona, demo: true }}
                      tag={state.tag}
                    />
                  )}
                </Ghost>
              ) : null}
            </SceneBackdrop>
          ) : null}
          <div className={styles.view}>
            {selectView(state, flow, letterId, personaName, persona, mode, retryAtZero, KeyStep, {
              keyText,
              onKeyTextChange: setKeyText,
            }, beginGuard.begin, seal, demo2On)}
          </div>
        </CeremonyRoot>
      </SkipProvider>
    </MotionProvider>
  );
}

/** The typed key text and its setter, owned by `OpeningFlow`. */
type KeyEntry = {
  keyText: string;
  onKeyTextChange: (text: string) => void;
};

/** Render the one view that belongs to the current `state.tag`. */
function selectView(
  state: FlowState,
  flow: ReturnType<typeof useOpeningFlow>,
  letterId: string,
  personaName: string,
  persona: OpeningFlowProps["persona"],
  mode: "persona" | "live",
  retryAtZero: () => void,
  KeyStep: KeyStepComponent | null,
  keyEntry: KeyEntry,
  begin: () => void,
  seal: SealController,
  demo2On: boolean,
): React.ReactNode {
  // The envelope's per-letter inputs: the persona list fields plus the demo
  // flag. These are always demo persona letters, so `demo` is true whenever a
  // persona is present. With no persona (spec 03 renders) the envelope falls
  // back to its default seal pattern and shows no dates (R3.7). The seal
  // patternKey is seeded from `persona.key` inside the Envelope/WaxSeal (R8.4).
  const envelopePersona: EnvelopePersona | undefined =
    persona === undefined ? undefined : { ...persona, demo: true };

  // The persona's written-as-of date, shown in the recall counter (R11.5). A
  // Live_Letter has no persona, so it gets no "as of" part.
  const writtenAsOf = mode === "persona" ? persona?.written_as_of : undefined;

  // `live` is set only when the hook runs in user key-source mode. A live
  // letter has no persona, so its envelope gets the opening instant directly.
  const live = flow.live;

  /** Render the shared EnvelopeView for one of the envelope-group variants. */
  const envelopeView = (
    variant: EnvelopeViewVariant,
    extra?: Partial<EnvelopeViewProps>,
  ): React.ReactNode => (
    <EnvelopeView
      variant={variant}
      persona={envelopePersona}
      held={mode === "persona"}
      frameWidth={mode === "live" ? "min(84vw, 22rem)" : undefined}
      onBegin={begin}
      onRetry={flow.retry}
      {...extra}
    />
  );

  switch (state.tag) {
    case "loading":
      return envelopeView("loading");

    case "sealed":
      // The still-sealed opening date and countdown come from EnvelopeView's
      // reused StillSealed. A persona reads `opens_at` from the list. A live
      // letter passes its opening instant with the precise countdown and the
      // single automatic re-check at zero. With no persona (spec 03 renders)
      // the closed envelope stands alone.
      return live === undefined
        ? envelopeView("sealed")
        : envelopeView("sealed", {
            sealedOpensAt: state.opensAt,
            stillSealed: { precise: true, onZero: retryAtZero },
          });

    case "openable":
      // `openable` is a brief transition into checking the seal; it shows the
      // same "Checking the seal." scene as `verifying`.
      return envelopeView("verifying");

    case "awaiting_key":
      // The reader's key step: the passkey control, the key field or both,
      // from the released envelope's wraps (R17.2, R17.10).
      if (live === undefined) return null;
      return envelopeView("unlock", {
        children:
          KeyStep === null ? null : (
            <KeyStep
              unlock={state.unlock}
              notice={state.notice}
              controls={live.unlock}
              keyText={keyEntry.keyText}
              onKeyTextChange={keyEntry.onKeyTextChange}
            />
          ),
      });

    case "unlocking":
      // The key has been given and the letter is being checked.
      return envelopeView("verifying");

    case "verifying":
      return envelopeView("verifying");

    case "verified":
      return envelopeView("verified");

    case "recall":
      // One RecallStep for recall, submitting and submit_failed, with the same
      // key, so the pager (and its question index) stays mounted across a failed
      // post (R11.12). The as-of date is shown on a persona letter only.
      return (
        <RecallStep
          key="recall"
          opened={state.opened}
          drafts={state.drafts}
          invalid={state.invalid}
          submitting={false}
          onEdit={flow.editDraft}
          onToggleNoAnswer={flow.toggleNoAnswer}
          onSubmit={flow.submit}
          writtenAsOf={writtenAsOf}
        />
      );

    case "submitting":
      return (
        <RecallStep
          key="recall"
          opened={state.opened}
          drafts={state.drafts}
          invalid={[]}
          submitting={true}
          onEdit={flow.editDraft}
          onToggleNoAnswer={flow.toggleNoAnswer}
          onSubmit={flow.submit}
          writtenAsOf={writtenAsOf}
        />
      );

    case "submit_failed":
      return (
        <RecallStep
          key="recall"
          opened={state.opened}
          drafts={state.drafts}
          invalid={[]}
          submitting={false}
          onEdit={flow.editDraft}
          onToggleNoAnswer={flow.toggleNoAnswer}
          onSubmit={flow.retryPost}
          failed={true}
          writtenAsOf={writtenAsOf}
        />
      );

    case "reveal":
      // The close (design.md "Close"): the live note for a Live_Letter, or the
      // persona close with Demo_2_On and the persona key. Reveal shows it only
      // once the figures have settled. A persona with no list entry gets no
      // close, so "Start over" never points at an empty key.
      return (
        <Reveal
          opened={state.opened}
          record={state.record}
          personaName={personaName}
          letterId={letterId}
          stage={state.stage}
          onAdvance={flow.advance}
          onShowAll={flow.showAll}
          seal={seal}
          variant={mode}
          close={
            mode === "live"
              ? { kind: "live" }
              : persona === undefined
                ? undefined
                : { kind: "persona", personaKey: persona.key, demo2On }
          }
        />
      );

    case "not_placed":
      return (
        <FlowError
          kind={mode === "live" ? "letterNotFound" : "notPlaced"}
          onRetry={flow.retry}
        />
      );

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
