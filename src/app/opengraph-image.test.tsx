// Feature: 08-judge-polish
//
// The Open Graph image route: its size export, its alt text and its rendered PNG.

import { describe, expect, it } from "vitest";
import OpenGraphImage, { alt, contentType, size } from "./opengraph-image";

describe("opengraph-image route", () => {
  it("exports a 1200 x 630 size", () => {
    expect(size).toEqual({ width: 1200, height: 630 });
  });

  it("serves a PNG with the landing headline as alt text", () => {
    expect(contentType).toBe("image/png");
    expect(alt).toBe("Your past self returns with the receipts.");
  });

  it("renders a PNG response", async () => {
    const res = await OpenGraphImage();
    expect(res.headers.get("content-type")).toBe("image/png");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });
});
