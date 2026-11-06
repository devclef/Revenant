// Feature: 09-demo-polish, A14 (branded not-found and error pages)
//
// Rendered by Next.js for any URL that matches no route, with a 404 status.
// A server component: no state, no data access, no crypto. Every word comes
// from copy.ts.

import { BrandedPage } from "@/components/ui/BrandedPage";
import { UI_COPY } from "@/components/ui/copy";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata(UI_COPY.pageMeta.notFound, "/");

export default function NotFound() {
  return <BrandedPage heading={UI_COPY.notFound.heading} body={UI_COPY.notFound.body} />;
}
