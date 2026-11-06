// Feature: 08-judge-polish, 09-demo-polish (F2)
//
// The Open Graph image route: its size export, its alt text, its rendered PNG
// and the source that draws it (Eyebrow and Tagline, no Accent text).

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BRAND_COPY } from "@/components/brand/copy";
import OpenGraphImage, { alt, contentType, size } from "./opengraph-image";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, "opengraph-image.tsx"), "utf8");

describe("opengraph-image route", () => {
  it("exports a 1200 x 630 size", () => {
    expect(size).toEqual({ width: 1200, height: 630 });
  });

  it("serves a PNG with the tagline as alt text", () => {
    expect(contentType).toBe("image/png");
    expect(alt).toBe("Memory rewrites itself. Revenant doesn't.");
  });

  it("renders a PNG response", async () => {
    const res = await OpenGraphImage();
    expect(res.headers.get("content-type")).toBe("image/png");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });
});

describe("opengraph-image source (F2)", () => {
  it("draws the Eyebrow and the Tagline from Brand_Copy", () => {
    expect(source).toContain("{BRAND_COPY.eyebrow}");
    expect(source).toContain("{tagline}");
    expect(source).toContain("BRAND_COPY.tagline");
  });

  it("has no Accent colour and no retired headline text", () => {
    expect(source).not.toMatch(/ACCENT/);
    expect(source).not.toMatch(/#ff7b1c/i);
    expect(source).not.toMatch(/receipts\./);
    expect(source).not.toMatch(/SCENE_COPY/);
  });

  it("still imports the ghost geometry it draws", () => {
    expect(source).toContain("ghost-geometry");
    expect(BRAND_COPY.eyebrow).toBe("The wax seal, resurrected.");
  });
});
