import { notFound } from "next/navigation";
import { SceneShell } from "@/components/ceremony/scene/SceneShell";
import { LiveLetter } from "@/components/live/LiveLetter";
import { isLetterId } from "@/lib/seal-format";

/**
 * The Letter_Page at `/l/[id]` (spec 06 task 8, R17.1, R17.13, design.md
 * "Letter_Page").
 *
 * A server component. It awaits `params`, and calls `notFound()` unless the
 * segment is a letter ID (`isLetterId`). It renders the plain Scene shell with
 * no Demo chip and no shell controls, so the region's own Calm, Skip and sound
 * controls (CeremonyRoot) are the only ones on the page. The wordmark links
 * home.
 *
 * It imports no crypto module and no database module. The letter ID comes only
 * from this URL segment, after its shape is checked. The client flow fetches
 * the letter and the secret through the existing routes.
 */
export default async function LetterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isLetterId(id)) {
    notFound();
  }

  return (
    <SceneShell variant="plain" demo={false} controls="none">
      <LiveLetter letterId={id} />
    </SceneShell>
  );
}
