import type { Metadata } from "next";
import { BRAND_COPY } from "../components/brand/copy";

/** The product name used as the Open Graph site name. */
export const SITE_NAME = "Revenant";

/** The page-level fields a route provides for its metadata. */
export interface PageInfo {
  /** The page's own title, without the site name. */
  title: string;
  /** A one-sentence description in Revenant's voice. */
  description: string;
}

/**
 * The description of the landing page: the Eyebrow and the Tagline from
 * Brand_Copy (OD16). The retired tagline is not used anywhere.
 */
export const HOME_DESCRIPTION = `${BRAND_COPY.eyebrow} ${BRAND_COPY.tagline}`;

/**
 * Builds the Next.js metadata for one page: title, description, and the
 * Open Graph and Twitter fields that link previews read.
 *
 * `page` is null for the landing page. Then no title is set, so the root
 * layout's default "Revenant" stays the document title (the template would
 * otherwise add " · Revenant" a second time), and the site description is used.
 *
 * `path` is the page's root-relative URL (for example "/demo"). Next.js
 * resolves it against `metadataBase` set in the root layout.
 */
export function pageMetadata(page: PageInfo | null, path: string): Metadata {
  const title = page?.title ?? SITE_NAME;
  const description = page?.description ?? HOME_DESCRIPTION;
  return {
    ...(page === null ? {} : { title: page.title }),
    description,
    openGraph: {
      title,
      description,
      url: path,
      images: ["/opengraph-image"],
      type: "website",
      siteName: SITE_NAME,
    },
    twitter: {
      card: "summary_large_image",
    },
  };
}
