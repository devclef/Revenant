import { BrandedPage } from "@/components/ui/BrandedPage";
import { DEMO_COPY } from "@/components/demo/copy";
import { UI_COPY } from "@/components/ui/copy";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata(UI_COPY.pageMeta.notFound, "/demo");

/**
 * Persona not-found page, rendered by Next.js when `page.tsx` calls
 * `notFound()` because the `[key]` route segment is not a known persona.
 *
 * A pure server component: no "use client", no state, no data access. It makes
 * no API request and imports no crypto. The heading and body come from
 * demo/copy.ts. BrandedPage supplies the Top_Bar, the heading in the sans and
 * the link back to /demo, so this page needs no styles of its own.
 */
export default function PersonaNotFound() {
  return <BrandedPage heading={DEMO_COPY.notFoundTitle} body={DEMO_COPY.notFoundBody} />;
}
