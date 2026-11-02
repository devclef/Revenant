import { DEMO_FIGURES } from "@/lib/figures/demo";

import { listPickableSeries } from "./catalogue-list";
import { WriteForm } from "./WriteForm";

/** The figures on offer, computed once from the demo figure file. */
const PICKABLE = listPickableSeries(DEMO_FIGURES);

export interface SealPageProps {
  /** The passkey relying-party ID (RP_ID), read at request time by the page. */
  rpId: string;
  /** The app origin (APP_ORIGIN) without a trailing slash. */
  appOrigin: string;
}

/**
 * The live Seal_Page: the write step, composed from the form. The page passes
 * `rpId` and `appOrigin` in; the passkey step (a later task) reads them.
 */
export function SealPage({ rpId, appOrigin }: SealPageProps) {
  return (
    <div data-rp-id={rpId} data-app-origin={appOrigin}>
      <WriteForm series={PICKABLE} />
    </div>
  );
}
