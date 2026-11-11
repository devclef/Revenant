import { describe, expect, it } from "vitest";
import { BRAND_COPY } from "../components/brand/copy";
import { HOME_DESCRIPTION, SITE_NAME, pageMetadata } from "./page-metadata";

describe("pageMetadata", () => {
  const page = {
    title: "Demo",
    description: "Open a persona letter.",
  };

  it("sets the page title and description", () => {
    const meta = pageMetadata(page, "/demo");
    expect(meta.title).toBe("Demo");
    expect(meta.description).toBe("Open a persona letter.");
  });

  it("returns the full Open Graph set", () => {
    const og = pageMetadata(page, "/demo").openGraph;
    expect(og).toEqual({
      title: "Demo",
      description: "Open a persona letter.",
      url: "/demo",
      images: ["/opengraph-image"],
      type: "website",
      siteName: SITE_NAME,
    });
  });

  it("uses the eyebrow and tagline as the landing description (OD16)", () => {
    expect(HOME_DESCRIPTION).toBe(
      "The wax seal, resurrected. Memory rewrites itself. Revenant doesn't.",
    );
    expect(HOME_DESCRIPTION).not.toContain("Your past self returns with the receipts.");
  });

  it("builds HOME_DESCRIPTION from the Brand_Copy eyebrow and tagline", () => {
    expect(HOME_DESCRIPTION).toBe(`${BRAND_COPY.eyebrow} ${BRAND_COPY.tagline}`);
  });

  it("uses HOME_DESCRIPTION for the landing page when there is no page info", () => {
    const meta = pageMetadata(null, "/");
    expect(meta.description).toBe(HOME_DESCRIPTION);
    expect(meta.openGraph?.description).toBe(HOME_DESCRIPTION);
    expect(meta.title).toBeUndefined();
  });

  it("uses Revenant as the site name", () => {
    expect(SITE_NAME).toBe("Revenant");
  });

  it("returns a summary_large_image Twitter card", () => {
    expect(pageMetadata(page, "/demo").twitter).toEqual({
      card: "summary_large_image",
    });
  });

  it("passes the given path through as the Open Graph url", () => {
    expect(pageMetadata(page, "/l/abc").openGraph?.url).toBe("/l/abc");
  });
});
