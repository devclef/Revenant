"use client";

import { useCallback, useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import Link from "next/link";

import "@/components/ceremony/scene/tokens.css";
import { useFigures, type FiguresState } from "@/components/reveal/figures-api";
import type { LoadedFigures } from "@/lib/figures";

import { realLetterSealApi, realSealApi, type SealApi } from "./api";
import { sealFiguresFrom } from "./catalogue-list";
import { LIVE_COPY } from "./copy";
import { BackupFallback } from "./BackupFallback";
import styles from "./live.module.css";
import { SealedView } from "./SealedView";
import { SealFailure } from "./SealFailure";
import type { AuthenticatorPort, SealDeps, SealDraft } from "./seal-runner";
import { useCryptoModule } from "./useCryptoModule";
import { useSealFlow } from "./useSealFlow";
import { WriteForm, type WriteSection } from "./WriteForm";
import type { FigureDetail } from "./FigurePicker";
import { usePrfHint } from "./prf-hint";
import { resolveTimeZone } from "./real-opening";
import type { WriteDraftEvent } from "./write-draft";
import {
  INITIAL_TOUCHED,
  markAttempted,
  markTouched,
  type TouchedState,
} from "./touched";
import { figureLimit } from "./form";
import { LiveStepper, type StepView } from "./stepper/LiveStepper";
import { LiveWaitStep } from "./stepper/LiveWaitStep";
import { initialStepperState, reduceStepper } from "./stepper/live-steps";
import { browserTimeZone } from "@/components/ui/letter-date";
import { earliestOpeningDate } from "@/lib/seal-format";

/** Figures used when the request has not resolved. Sealing is blocked then. */
const NO_FIGURES: LoadedFigures = { fixture: false, series: new Map() };

/**
 * The value and source of each official figure in a ready response, keyed by
 * metric id, in the response's (catalogue) order. The value is the string the
 * response carries, unchanged. A self-reported figure has no source_url, so it
 * gets no entry and the picker shows it without a value.
 */
function figureDetailsFrom(state: FiguresState): ReadonlyMap<string, FigureDetail> {
  const details = new Map<string, FigureDetail>();
  if (state.status !== "ready") return details;
  for (const entry of state.figures.series) {
    const figure = entry.figure;
    if (figure === null || figure.kind !== "official") continue;
    details.set(entry.metric.id, {
      value: figure.value,
      sourceName: figure.source,
      seriesId: figure.series_id,
      sourceUrl: figure.source_url,
      retrievedAt: figure.retrieved_at,
      period: figure.period,
      unit: figure.unit,
      region: figure.region,
    });
  }
  return details;
}

/**
 * The injectable parts of the flow (R11.5): the browser port, the routes, the
 * figures request and the clock. The QA stub passes its own port, api and
 * nowMs. The default port is the crypto module's own
 * `browserAuthenticatorPort`, taken from the dynamically loaded module so this
 * file never statically imports `@/lib/crypto` (the component import boundary
 * forbids that).
 *
 * The figures come only from GET /api/figures (issue #202). There is no bundled
 * fallback: `fetchFigures` replaces the browser `fetch` for that one request.
 */
export interface SealPageDeps {
  port: AuthenticatorPort;
  api: SealApi;
  fetchFigures?: typeof fetch;
  nowMs: () => number;
}

/**
 * Which sealing mode the page runs in. `demo` is the Live_Letter Seal_Page at
 * `/demo/live`. `real` is the Real_Seal_Page at `/seal` (spec 08, task 22).
 * The two run the same Sealing_Flow steps in the same order; only the routes
 * differ.
 */
export type SealPageMode = "demo" | "real";

/**
 * The seal API for a mode. An injected `deps.api` always wins. Otherwise demo
 * mode uses `realSealApi` (the Live_Letter routes) and real mode uses
 * `realLetterSealApi` (the Real_Letter routes), so a real seal never posts to a
 * demo route.
 */
export function sealApiFor(mode: SealPageMode, injected?: SealApi): SealApi {
  if (injected) return injected;
  return mode === "real" ? realLetterSealApi : realSealApi;
}

export interface SealPageProps {
  /** The passkey relying-party ID (RP_ID), read at request time by the page. */
  rpId: string;
  /** The app origin (APP_ORIGIN) without a trailing slash. */
  appOrigin: string;
  /** `demo` (default) for `/demo/live`; `real` for `/seal`. */
  mode?: SealPageMode;
  /**
   * The one injection point for the port, routes, figures and clock (R11.5).
   * Any field left out falls back to the real default: the loaded crypto
   * module's `browserAuthenticatorPort`, the mode's seal API, `DEMO_FIGURES` and
   * `Date.now`.
   */
  deps?: Partial<SealPageDeps>;
}

/** How the write form is shown for one stepper step (spec 09, D2). */
interface WriteNav {
  section?: WriteSection;
  onNext?: () => void;
  onBack?: () => void;
}

/**
 * The live Seal_Page: the write step, the sealing flow and the result views.
 * The page owns useSealFlow; WriteForm stays presentational and reports its
 * draft up. The crypto module loads on mount (useCryptoModule); the two presses
 * stay disabled until it has (R15.3). The page root carries
 * `data-live-step={state.tag}` for the QA agent.
 *
 * Demo mode (`/demo/live`) runs inside the Live_Stepper (spec 09, D2). Real
 * mode (`/seal`) keeps the single form.
 */
export function SealPage({ rpId, appOrigin, mode = "demo", deps }: SealPageProps) {
  const crypto = useCryptoModule();
  const prfHint = usePrfHint();
  const figuresState = useFigures(deps?.fetchFigures);
  const sealFigures = useMemo(() => sealFiguresFrom(figuresState), [figuresState]);
  const figureDetails = useMemo(() => figureDetailsFrom(figuresState), [figuresState]);
  const figuresReady = sealFigures.status === "ready";
  const pickable = sealFigures.status === "ready" ? sealFigures.pickable : [];
  const figureMax = figureLimit(pickable.length);

  // The letter text, chosen figures and warning tick live in the stepper state,
  // which this page owns. That is the single copy of the draft: the stepper's
  // Back keeps it, and the cancelled, failed and cannot_lock screens and Try
  // again still show it. It is dropped once the seal is stored (SEALED below).
  // No passkey or key material is kept here.
  const [stepper, dispatchStepper] = useReducer(
    reduceStepper,
    mode,
    (initialMode: SealPageMode) => initialStepperState("write", initialMode),
  );
  const writeDraft = stepper.draft;
  const dispatchDraft = useCallback(
    (event: WriteDraftEvent) => dispatchStepper({ type: "DRAFT", event }),
    [],
  );

  // SealDeps for the runner, built once the crypto module is loaded and the
  // figures response is ready. Null until both, which keeps the flow's presses
  // disabled. A failed figures request therefore blocks sealing.
  const sealDeps: SealDeps | null = useMemo(() => {
    if (crypto === null || !figuresReady) return null;
    return {
      crypto,
      port: deps?.port ?? crypto.browserAuthenticatorPort,
      api: sealApiFor(mode, deps?.api),
      rpId,
      now: deps?.nowMs ?? Date.now,
    };
  }, [crypto, figuresReady, deps?.port, deps?.api, deps?.nowMs, rpId, mode]);

  // The flow reads the draft at Confirm_Press; memoised so the handlers keep
  // their identity while the form is unchanged. The figures are the response's,
  // and the empty set stands in only while sealDeps is null.
  const sealedFigures = sealFigures.status === "ready" ? sealFigures.figures : NO_FIGURES;
  // Real mode only: the opening date (held here, so Try again keeps it) and the
  // zone it opens in. The zone falls back to UTC when the browser's is unknown.
  const [opensOn, setOpensOn] = useState<string | null>(null);
  // Which fields the judge has touched, and whether they tried to seal. Held
  // here so the messages survive the failed and cannot_lock screens (spec 09, A4.4).
  const [touched, setTouched] = useState<TouchedState>(INITIAL_TOUCHED);
  const onTouch = useCallback(
    (field: string) => setTouched((prev) => markTouched(prev, field)),
    [],
  );
  const onAttempt = useCallback(() => setTouched(markAttempted), []);
  const timeZone = useMemo(() => resolveTimeZone(browserTimeZone()), []);
  const draft: SealDraft = useMemo(
    () => ({
      text: writeDraft.text,
      metricIds: writeDraft.metricIds,
      questions: writeDraft.questions,
      figures: sealedFigures,
      backupCard: writeDraft.backupCardTicked,
      ...(mode === "real" ? { real: { opensOn, timeZone: timeZone.timeZone } } : {}),
    }),
    [writeDraft.text, writeDraft.metricIds, writeDraft.questions, writeDraft.backupCardTicked, sealedFigures, mode, opensOn, timeZone],
  );

  const flow = useSealFlow(sealDeps, draft);
  const { state } = flow;

  // Once the seal is stored, the draft is dropped from the stepper state and
  // Back is no longer offered (spec 09, D2.3). Every mode does this once.
  useEffect(() => {
    if (state.tag === "sealed" && !stepper.sealed) {
      dispatchStepper({ type: "SEALED" });
    }
  }, [state.tag, stepper.sealed]);

  return (
    <div
      data-rp-id={rpId}
      data-app-origin={appOrigin}
      data-seal-mode={mode}
      data-live-step={state.tag}
    >
      <p className={styles.backToDemo}>
        <Link href="/demo">{LIVE_COPY.backToDemo}</Link>
      </p>
      {mode === "demo" ? (
        <>
          <h1 className={styles.liveHeading}>{LIVE_COPY.liveHeading}</h1>
          <LiveStepper
            state={stepper}
            dispatch={dispatchStepper}
            renderStep={renderDemoStep}
          />
        </>
      ) : (
        renderState()
      )}
    </div>
  );

  /**
   * The content of one stepper step in demo mode. Once the seal is stored the
   * sealed view takes over. The failure and fallback screens replace the step
   * content too. Until then the step picks which part of the write form shows.
   */
  function renderDemoStep(view: StepView) {
    if (state.tag === "sealed") {
      // Wait, Testify and Receipts share one card: the countdown, then the
      // embedded Opening_Flow (spec 09, D5). The seal's own state stays
      // `sealed` for the rest of the page.
      return (
        <SealedStep view={view}>
          <LiveWaitStep
            state={state}
            appOrigin={appOrigin}
            step={view.step}
            advanceTo={view.advanceTo}
            nowMs={deps?.nowMs ?? Date.now}
            getBackupKeyText={flow.getBackupKeyText}
            port={deps?.port}
          />
        </SealedStep>
      );
    }
    switch (state.tag) {
      case "cannot_lock":
      case "cancelled":
      case "failed":
      case "fallback_key":
        return renderState();
      default:
        break;
    }
    const section: WriteSection =
      view.step === "write" ? "write" : view.step === "figures" ? "figures" : "seal";
    return writeForm({
      section,
      onNext: view.next,
      // Back is offered only before a passkey prompt has started (spec 09, D2.2).
      onBack: view.canGoBack && state.tag === "write" ? view.back : undefined,
    });
  }

  function renderState() {
    switch (state.tag) {
      case "sealed":
        return (
          <SealedView
            state={state}
            appOrigin={appOrigin}
            nowMs={deps?.nowMs ?? Date.now}
            getBackupKeyText={flow.getBackupKeyText}
            real={mode === "real"}
          />
        );
      case "cannot_lock":
      case "cancelled":
      case "failed":
        return (
          <SealFailure
            state={state}
            onRetry={flow.onRetry}
            onFallbackStart={flow.onFallbackStart}
          />
        );
      case "fallback_key": {
        // The key is generated on FALLBACK_START, so it is present here. The
        // null guard only covers a state that should never reach this branch.
        const fallbackKeyText = flow.getBackupKeyText();
        if (fallbackKeyText === null) return null;
        return (
          <BackupFallback
            keyText={fallbackKeyText}
            onSealPress={flow.onFallbackSealPress}
            onDecline={flow.onFallbackDecline}
          />
        );
      }
      default:
        // write, creating, created, confirming, preparing, sealing: the write
        // form knows which of its controls to show for each step.
        return writeForm();
    }
  }

  /** The write form. `nav` is set only by the stepper, to show one step. */
  function writeForm(nav?: WriteNav) {
    return (
      <WriteForm
        section={nav?.section}
        onNext={nav?.onNext}
        onBack={nav?.onBack}
        series={pickable}
        figureDetails={figureDetails}
        figuresStatus={sealFigures.status}
        prfHint={prfHint}
        state={state}
        cryptoLoaded={crypto !== null}
        text={writeDraft.text}
        metricIds={writeDraft.metricIds}
        warningTicked={writeDraft.warningTicked}
        backupCardTicked={writeDraft.backupCardTicked}
        touched={touched}
        onTouch={onTouch}
        onAttempt={onAttempt}
        onTextChange={(text) => dispatchDraft({ type: "TEXT_CHANGED", text })}
        questions={writeDraft.questions}
        onQuestionChange={(index, text) =>
          dispatchDraft({ type: "QUESTION_CHANGED", index, text })
        }
        onQuestionAdd={() => dispatchDraft({ type: "QUESTION_ADDED" })}
        onQuestionRemove={(index) =>
          dispatchDraft({ type: "QUESTION_REMOVED", index })
        }
        onQuestionStarter={(text) =>
          dispatchDraft({ type: "QUESTION_STARTER", text })
        }
        onToggleFigure={(metricId) =>
          dispatchDraft({ type: "FIGURE_TOGGLED", metricId, limit: figureMax })
        }
        onWarningChange={(ticked) =>
          dispatchDraft({ type: "WARNING_CHANGED", ticked })
        }
        onBackupCardChange={(ticked) =>
          dispatchDraft({ type: "BACKUP_CARD_CHANGED", ticked })
        }
        onCreatePress={flow.onCreatePress}
        onConfirmPress={flow.onConfirmPress}
        realDate={
          mode === "real"
            ? {
                value: opensOn,
                min: earliestOpeningDate((deps?.nowMs ?? Date.now)(), timeZone.timeZone),
                timeZoneFallback: timeZone.fallback,
                onChange: setOpensOn,
              }
            : undefined
        }
      />
    );
  }
}

/**
 * Moves the stepper from Seal to Wait once the seal is stored (spec 09, D2.2).
 * It runs the advance only while the step is still Seal, so the visitor is
 * never moved past Wait. The sealed content renders as the children.
 */
function SealedStep({ view, children }: { view: StepView; children: ReactNode }) {
  const { step, advanceTo } = view;
  useEffect(() => {
    if (step === "seal") advanceTo("wait");
  }, [step, advanceTo]);
  return <>{children}</>;
}
