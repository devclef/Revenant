import { describe, expect, it } from "vitest";
import { encodeQr } from "./qr/encode";
import { DEFAULT_QUIET_ZONE, qrToSvg } from "./qr-svg";

/** Rebuilds the dark modules from the path: each `M x y hW v1 h-W z` is a run of dark cells. */
function darkCellsFromPath(d: string, quiet: number, size: number): boolean[][] {
  const grid = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  for (const [, x, y, w] of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    for (let i = 0; i < Number(w); i++) grid[Number(y) - quiet][Number(x) - quiet + i] = true;
  }
  return grid;
}

describe("qrToSvg", () => {
  const qr = encodeQr("https://revenant.devclef.se/l/k7q2m9x4p1", "M");

  it("returns one svg with one path, crisp edges and a 4-module quiet zone by default", () => {
    const svg = qrToSvg(qr);
    expect(DEFAULT_QUIET_ZONE).toBe(4);
    expect(svg.startsWith("<svg ")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg.match(/<svg[\s>]/g)).toHaveLength(1);
    expect(svg.match(/<path[\s/]/g)).toHaveLength(1);
    expect(svg).toContain('shape-rendering="crispEdges"');
    const side = qr.size + 8;
    expect(svg).toContain(`viewBox="0 0 ${side} ${side}"`);
  });

  it("sets the quiet zone from options", () => {
    const svg = qrToSvg(qr, { quiet: 2 });
    expect(svg).toContain(`viewBox="0 0 ${qr.size + 4} ${qr.size + 4}"`);
  });

  it("draws exactly the dark modules, at the right offset", () => {
    for (const quiet of [0, 4]) {
      const svg = qrToSvg(qr, { quiet });
      const d = /<path fill="#000" d="([^"]*)"/.exec(svg)?.[1] ?? "";
      const cells = darkCellsFromPath(d, quiet, qr.size);
      for (let r = 0; r < qr.size; r++) {
        for (let c = 0; c < qr.size; c++) {
          expect(cells[r][c]).toBe(qr.modules[r][c]);
        }
      }
    }
  });

  it("rejects a negative or fractional quiet zone", () => {
    expect(() => qrToSvg(qr, { quiet: -1 })).toThrow(RangeError);
    expect(() => qrToSvg(qr, { quiet: 1.5 })).toThrow(RangeError);
  });
});
