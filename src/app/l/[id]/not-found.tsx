import { BrandedPage } from "@/components/ui/BrandedPage";
import { LIVE_COPY } from "@/components/live/copy";
import { UI_COPY } from "@/components/ui/copy";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata(UI_COPY.pageMeta.notFound, "/demo");

/**
 * Not-found page for `/l/[id]`, shown when the page calls `notFound()` because
 * the segment is not a letter ID (R17.1).
 *
 * A server component with no state and no data access. It makes no request and
 * imports no crypto or database module. The heading and body come from the
 * live copy. BrandedPage links to /demo, where the reader can find another
 * letter.
 */
export default function LetterNotFound() {
  return <BrandedPage heading={LIVE_COPY.letterNotFoundTitle} body={LIVE_COPY.letterNotFound} />;
}
