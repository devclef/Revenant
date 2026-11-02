import Link from "next/link";
import { PageShell, ParchmentSurface } from "@/components/ui";
import { DEMO_COPY } from "@/components/demo/copy";
import { LIVE_COPY } from "@/components/live/copy";

/**
 * Not-found page for `/l/[id]`, shown when the page calls `notFound()` because
 * the segment is not a letter ID (R17.1).
 *
 * A server component with no state and no data access. It makes no request and
 * imports no crypto or database module. The words come from the live copy and
 * the demo copy, so the page holds no inline literals (R19.1). The link goes to
 * `/demo`, where the reader can find another letter.
 */
export default function LetterNotFound() {
  return (
    <PageShell>
      <ParchmentSurface as="section">
        <p>{LIVE_COPY.letterNotFound}</p>
        <Link href="/demo">{DEMO_COPY.backToDemo}</Link>
      </ParchmentSurface>
    </PageShell>
  );
}
