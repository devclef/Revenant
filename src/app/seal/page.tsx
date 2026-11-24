import { SceneShell } from "@/components/ceremony/scene/SceneShell";
import { SealPage } from "@/components/live/SealPage";
import { Unavailable } from "@/components/live/Unavailable";
import { BrandedPage } from "@/components/ui/BrandedPage";
import { UI_COPY } from "@/components/ui/copy";
import { realSealingOn } from "@/lib/feature-flags";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata(UI_COPY.pageMeta.live, "/seal");

/**
 * The Real_Seal_Page at `/seal` (spec 08, task 22, R25.5). A server component.
 * While REAL_SEALING is not exactly "on" it renders the branded not-found
 * screen (spec 15, task 7.2) in place of the sealing flow. The sealing flow
 * code below stays intact for when real sealing is switched on. Otherwise it
 * renders the Seal_Page in `real` mode. It reads
 * RP_ID and APP_ORIGIN at request time. When RP_ID is empty it shows the
 * Unavailable state with no seal control.
 *
 * The page sits on the plain Scene shell with no Demo chip: a Real_Letter is
 * not a demo.
 *
 * This page imports no letter-store module and holds no letter data.
 */
export const dynamic = "force-dynamic";

export default function RealSealPage() {
  if (!realSealingOn()) {
    return (
      <BrandedPage
        heading={UI_COPY.notFound.heading}
        body={UI_COPY.notFound.body}
        link={{ href: "/demo/live", label: UI_COPY.notFound.sealLink }}
      />
    );
  }

  const rpId = (process.env.RP_ID ?? "").trim();
  const appOrigin = (process.env.APP_ORIGIN ?? "").trim().replace(/\/+$/, "");

  return (
    <SceneShell variant="plain" demo={false} backdrop>
      {rpId === "" ? (
        <Unavailable />
      ) : (
        <SealPage rpId={rpId} appOrigin={appOrigin} mode="real" />
      )}
    </SceneShell>
  );
}
