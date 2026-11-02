import { notFound } from "next/navigation";
import { DeskScene } from "@/components/ceremony/desk/DeskScene";
import { MotionProvider } from "@/components/ceremony/motion";
import { LiveLetter } from "@/components/live/LiveLetter";
import { isLetterId } from "@/lib/seal-format";

/**
 * The Letter_Page at `/l/[id]` (spec 06 task 8, R17.1, R17.13, design.md
 * "Letter_Page").
 *
 * A server component. It awaits `params`, and calls `notFound()` unless the
 * segment is a letter ID (`isLetterId`). It renders the desk, the motion
 * provider and `LiveLetter`, which runs the opening flow in live mode.
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
    <MotionProvider>
      <DeskScene>
        <LiveLetter letterId={id} />
      </DeskScene>
    </MotionProvider>
  );
}
