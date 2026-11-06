import { notFound } from "next/navigation";

import { SceneShell } from "@/components/ceremony/scene/SceneShell";
import { SealPage } from "@/components/live/SealPage";
import { Unavailable } from "@/components/live/Unavailable";
import { UI_COPY } from "@/components/ui/copy";
import { realSealingOn } from "@/lib/feature-flags";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata(UI_COPY.pageMeta.live, "/seal");

/**
 * The Real_Seal_Page at `/seal` (spec 08, task 22, R25.5). A server component.
 * While REAL_SEALING is not exactly "on" it calls `notFound()`, so the route
 * looks absent. Otherwise it renders the Seal_Page in `real` mode. It reads
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
    notFound();
  }

  const rpId = (process.env.RP_ID ?? "").trim();
  const appOrigin = (process.env.APP_ORIGIN ?? "").trim().replace(/\/+$/, "");

  return (
    <SceneShell variant="plain" demo={false}>
      {rpId === "" ? (
        <Unavailable />
      ) : (
        <SealPage rpId={rpId} appOrigin={appOrigin} mode="real" />
      )}
    </SceneShell>
  );
}
