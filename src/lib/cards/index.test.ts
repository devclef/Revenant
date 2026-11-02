import { describe, expect, it } from "vitest";
import * as cards from "./index";

describe("cards index", () => {
  it("exports the QR encoder and the SVG renderer", () => {
    expect(typeof cards.encodeQr).toBe("function");
    expect(typeof cards.qrToSvg).toBe("function");
    expect(cards.DEFAULT_QUIET_ZONE).toBe(4);
  });

  it("renders an encoded letter link end to end", () => {
    const svg = cards.qrToSvg(cards.encodeQr("https://revenant.devclef.se/l/abc"));
    expect(svg).toMatch(/^<svg /);
  });
});
