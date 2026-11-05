import { SceneShell } from "@/components/ceremony/scene/SceneShell";
import { SealPage } from "@/components/live/SealPage";
import { Unavailable } from "@/components/live/Unavailable";

/**
 * The live demo Seal_Page at `/demo/live` (spec 06, R12.8). A server component.
 * It reads RP_ID and APP_ORIGIN from the environment at request time, so the
 * value is never fixed at build time. When RP_ID is empty it shows the
 * Unavailable state with no seal control. Otherwise it renders SealPage.
 *
 * The page sits on the plain Scene shell (spec 07), which adds the Demo chip
 * and the Top_Bar with a way back to `/`.
 *
 * This page must not import any letter-store module. It holds no letter data
 * and no database access.
 */
export const dynamic = "force-dynamic";

export default function LiveDemoPage() {
  const rpId = (process.env.RP_ID ?? "").trim();
  const appOrigin = (process.env.APP_ORIGIN ?? "").trim().replace(/\/+$/, "");

  return (
    <SceneShell variant="plain" demo>
      {rpId === "" ? (
        <Unavailable />
      ) : (
        <SealPage rpId={rpId} appOrigin={appOrigin} />
      )}
    </SceneShell>
  );
}
