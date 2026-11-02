"use client";

import { useMemo, useRef } from "react";

import { DEMO_FIGURES } from "@/lib/figures/demo";
import type { LoadedFigures } from "@/lib/figures";

import { realSealApi, type SealApi } from "./api";
import { listPickableSeries } from "./catalogue-list";
import type { AuthenticatorPort, SealDeps, SealDraft } from "./seal-runner";
import { useCryptoModule } from "./useCryptoModule";
import { useSealFlow } from "./useSealFlow";
import { WriteForm, type WriteDraft } from "./WriteForm";

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

  // The letter text and chosen figures as the form holds them now. Read at
  // Confirm_Press time, so the draft is the one on screen at that moment.
  const writeDraft = useRef<WriteDraft>({ text: "", metricIds: [] });
  function onDraftChange(next: WriteDraft): void {
    writeDraft.current = next;
  }

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

  const draft: SealDraft = {
    text: writeDraft.current.text,
    metricIds: writeDraft.current.metricIds,
    figures: deps?.figures ?? DEMO_FIGURES,
  };

  const flow = useSealFlow(sealDeps, draft);
  const { state } = flow;

  return (
    <div
      data-rp-id={rpId}
      data-app-origin={appOrigin}
      data-live-step={state.tag}
    >
      {/*
        The failure and sealed views arrive in later steps (tasks 6 and 7).
        Until then every state renders the write form, so the page still works.
      */}
      <WriteForm
        series={PICKABLE}
        state={state}
        cryptoLoaded={crypto !== null}
        onCreatePress={flow.onCreatePress}
        onConfirmPress={flow.onConfirmPress}
        onDraftChange={onDraftChange}
      />
    </div>
  );
}
