// Feature: 08-judge-polish
//
// The Apple touch icon route: its size export and its rendered PNG.

import { describe, expect, it } from "vitest";
import AppleIcon, { contentType, size } from "./apple-icon";

describe("apple-icon route", () => {
  it("exports a 180 x 180 size", () => {
    expect(size).toEqual({ width: 180, height: 180 });
  });

  it("serves a PNG", () => {
    expect(contentType).toBe("image/png");
  });

  it("renders a PNG response", async () => {
    const res = await AppleIcon();
    expect(res.headers.get("content-type")).toBe("image/png");
    const bytes = new Uint8Array(await res.arrayBuffer());
    // PNG signature: 0x89 'P' 'N' 'G'.
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });
});
