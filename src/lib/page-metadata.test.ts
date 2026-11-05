import { describe, expect, it } from "vitest";
import { SITE_NAME, pageMetadata } from "./page-metadata";

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
