"use client";

import { useMemo, useReducer } from "react";

import { DEMO_FIGURES } from "@/lib/figures/demo";
import type { LoadedFigures } from "@/lib/figures";

import { realSealApi, type SealApi } from "./api";
import { listPickableSeries } from "./catalogue-list";
import { BackupFallback } from "./BackupFallback";
import { SealedView } from "./SealedView";
import { SealFailure } from "./SealFailure";
import type { AuthenticatorPort, SealDeps, SealDraft } from "./seal-runner";
import { useCryptoModule } from "./useCryptoModule";
import { useSealFlow } from "./useSealFlow";
import { WriteForm } from "./WriteForm";
import { INITIAL_WRITE_DRAFT, reduceWriteDraft } from "./write-draft";

/** The figures on offer, computed once from the demo figure file. */
const PICKABLE = listPickableSeries(DEMO_FIGURES);

/**
 * The injectable parts of the flow (R11.5): the browser port, the routes, the
 * figures and the clock. The QA stub passes its own port, api and nowMs. The
 * default port is the crypto module's own `browserAuthenticatorPort`, taken
 * from the dynamically loaded module so this file never statically imports
 * `@/lib/crypto` (the component import boundary forbids that).
 */
export interface SealPageDeps {
  port: AuthenticatorPort;
  api: SealApi;
  figures: LoadedFigures;
  nowMs: () => number;
}

export interface SealPageProps {
  /** The passkey relying-party ID (RP_ID), read at request time by the page. */
  rpId: string;
  /** The app origin (APP_ORIGIN) without a trailing slash. */
  appOrigin: string;
  /**
   * The one injection point for the port, routes, figures and clock (R11.5).
   * Any field left out falls back to the real default: the loaded crypto
   * module's `browserAuthenticatorPort`, `realSealApi`, `DEMO_FIGURES` and
   * `Date.now`.
   */
  deps?: Partial<SealPageDeps>;
}

/**
 * The live Seal_Page: the write step, the sealing flow and the result views.
 * The page owns useSealFlow; WriteForm stays presentational and reports its
 * draft up. The crypto module loads on mount (useCryptoModule); the two presses
 * stay disabled until it has (R15.3). The page root carries
 * `data-live-step={state.tag}` for the QA agent.
 */
export function SealPage({ rpId, appOrigin, deps }: SealPageProps) {
  const crypto = useCryptoModule();

  // The letter text, chosen figures and warning tick. The page holds them, not
  // WriteForm, so they survive the cancelled, failed and cannot_lock screens and
  // Try again shows them again. No passkey or key material is kept here.
  const [writeDraft, dispatchDraft] = useReducer(
    reduceWriteDraft,
    INITIAL_WRITE_DRAFT,
  );

  // SealDeps for the runner, built once the crypto module is loaded. Null until
  // then, which keeps the flow's presses disabled.
  const sealDeps: SealDeps | null = useMemo(() => {
    if (crypto === null) return null;
    return {
      crypto,
      port: deps?.port ?? crypto.browserAuthenticatorPort,
      api: deps?.api ?? realSealApi,
      rpId,
      now: deps?.nowMs ?? Date.now,
    };
  }, [crypto, deps?.port, deps?.api, deps?.nowMs, rpId]);

  // The flow reads the draft at Confirm_Press; memoised so the handlers keep
  // their identity while the form is unchanged.
  const draft: SealDraft = useMemo(
    () => ({
      text: writeDraft.text,
      metricIds: writeDraft.metricIds,
      figures: deps?.figures ?? DEMO_FIGURES,
    }),
    [writeDraft.text, writeDraft.metricIds, deps?.figures],
  );

  const flow = useSealFlow(sealDeps, draft);
  const { state } = flow;

  return (
    <div
      data-rp-id={rpId}
      data-app-origin={appOrigin}
      data-live-step={state.tag}
    >
      {renderState()}
    </div>
  );

  function renderState() {
    switch (state.tag) {
      case "sealed":
        return (
          <SealedView
            state={state}
            appOrigin={appOrigin}
            nowMs={deps?.nowMs ?? Date.now}
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
      case "fallback_key":
        // The key is generated on FALLBACK_START, so it is present here. The
        // null guard only covers a state that should never reach this branch.
        if (flow.backupKeyText === null) return null;
        return (
          <BackupFallback
            keyText={flow.backupKeyText}
            onSealPress={flow.onFallbackSealPress}
            onDecline={flow.onFallbackDecline}
          />
        );
      default:
        // write, creating, created, confirming, preparing, sealing: the write
        // form knows which of its controls to show for each step.
        return (
          <WriteForm
            series={PICKABLE}
            state={state}
            cryptoLoaded={crypto !== null}
            text={writeDraft.text}
            metricIds={writeDraft.metricIds}
            warningTicked={writeDraft.warningTicked}
            onTextChange={(text) =>
              dispatchDraft({ type: "TEXT_CHANGED", text })
            }
            onToggleFigure={(metricId) =>
              dispatchDraft({ type: "FIGURE_TOGGLED", metricId })
            }
            onWarningChange={(ticked) =>
              dispatchDraft({ type: "WARNING_CHANGED", ticked })
            }
            onCreatePress={flow.onCreatePress}
            onConfirmPress={flow.onConfirmPress}
          />
        );
    }
  }
}
