import type { Metadata } from "next";

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
 * Builds the Next.js metadata for one page: title, description, and the
 * Open Graph and Twitter fields that link previews read.
 *
 * `path` is the page's root-relative URL (for example "/demo"). Next.js
 * resolves it against `metadataBase` set in the root layout.
 */
export function pageMetadata(page: PageInfo, path: string): Metadata {
  return {
    title: page.title,
    description: page.description,
    openGraph: {
      title: page.title,
      description: page.description,
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
