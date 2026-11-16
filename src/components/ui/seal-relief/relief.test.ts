// Feature: 13-the-seal (U1, U10)
//
// Example tests for the seal relief: slot tables, fixed hashes, blank input,
// the path output and the source rules (G1.5, no trig or random at run time).
// The property tests are in relief.properties.test.ts.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { reliefArt } from "./seal-art";
import {
  BLANK_RELIEF,
  coarseDifference,
  isFingerprintHex,
  sealRelief,
  type SealRelief,
} from "./relief";
import {
  DOT_DIR,
  DOT_TAN,
  NOTCH_DIR,
  NOTCH_TAN,
  TICK_DIR,
  TICK_TAN,
} from "./slot-vectors";
import { pixelDifferencePercent } from "./raster.testing";
import {
  LANDING_HASH,
  MAYA_HASH,
  PRIYA_HASH,
  TOMAS_HASH,
} from "./hashes.testing";

function relief(hash: string): Extract<SealRelief, { kind: "relief" }> {
  const r = sealRelief(hash);
  if (r.kind !== "relief") throw new Error(`expected a relief for ${hash}`);
  return r;
}

function angleDeg(k: number, offsetDeg: number, stepDeg: number): number {
  return (k + offsetDeg) * stepDeg;
}

describe("slot tables", () => {
  const TOL = 1e-6;

  it("tick slots are 11.25 degrees apart, and match Math.sin and Math.cos", () => {
    expect(TICK_DIR).toHaveLength(32);
    expect(TICK_TAN).toHaveLength(32);
    for (let k = 0; k < 32; k++) {
      const a = (angleDeg(k, 0, 11.25) * Math.PI) / 180;
      expect(Math.abs(TICK_DIR[k][0] - Math.sin(a))).toBeLessThan(TOL);
      expect(Math.abs(TICK_DIR[k][1] - -Math.cos(a))).toBeLessThan(TOL);
      expect(Math.abs(TICK_TAN[k][0] - Math.cos(a))).toBeLessThan(TOL);
      expect(Math.abs(TICK_TAN[k][1] - Math.sin(a))).toBeLessThan(TOL);
    }
  });

  it("dot slots are offset by half a slot, and match Math.sin and Math.cos", () => {
    expect(DOT_DIR).toHaveLength(32);
    expect(DOT_TAN).toHaveLength(32);
    for (let k = 0; k < 32; k++) {
      const a = (angleDeg(k, 0.5, 11.25) * Math.PI) / 180;
      expect(Math.abs(DOT_DIR[k][0] - Math.sin(a))).toBeLessThan(TOL);
      expect(Math.abs(DOT_DIR[k][1] - -Math.cos(a))).toBeLessThan(TOL);
      expect(Math.abs(DOT_TAN[k][0] - Math.cos(a))).toBeLessThan(TOL);
      expect(Math.abs(DOT_TAN[k][1] - Math.sin(a))).toBeLessThan(TOL);
    }
  });

  it("notch slots are 15 degrees apart, and match Math.sin and Math.cos", () => {
    expect(NOTCH_DIR).toHaveLength(24);
    expect(NOTCH_TAN).toHaveLength(24);
    for (let j = 0; j < 24; j++) {
      const a = (angleDeg(j, 0, 15) * Math.PI) / 180;
      expect(Math.abs(NOTCH_DIR[j][0] - Math.sin(a))).toBeLessThan(TOL);
      expect(Math.abs(NOTCH_DIR[j][1] - -Math.cos(a))).toBeLessThan(TOL);
      expect(Math.abs(NOTCH_TAN[j][0] - Math.cos(a))).toBeLessThan(TOL);
      expect(Math.abs(NOTCH_TAN[j][1] - Math.sin(a))).toBeLessThan(TOL);
    }
  });
});

describe("fixed hashes", () => {
  it("the landing hash draws 64 fine marks and the coarse layer it derives", () => {
    const r = relief(LANDING_HASH);
    expect(r.marks).toHaveLength(64);
    expect(r.coarse.signature).toBe("n5;s6;m0;r=both");
    expect(r.coarse.notches.map((n) => n.slot)).toEqual([6, 11, 16, 20, 1]);
    expect(r.coarse.rings.map((g) => g.band)).toEqual(["inner", "outer"]);
  });

  it("Maya draws 7 notches at slots 20, 17, 13, 10, 6, 3, 23, with the outer ring", () => {
    const r = relief(MAYA_HASH);
    expect(r.marks).toHaveLength(64);
    expect(r.coarse.signature).toBe("n7;s20;m1;r=outer");
    expect(r.coarse.notches.map((n) => n.slot)).toEqual([
      20, 17, 13, 10, 6, 3, 23,
    ]);
  });

  it("Tomas draws 3 notches at slots 6, 22, 14, with the outer ring", () => {
    const r = relief(TOMAS_HASH);
    expect(r.marks).toHaveLength(64);
    expect(r.coarse.signature).toBe("n3;s6;m1;r=outer");
    expect(r.coarse.notches.map((n) => n.slot)).toEqual([6, 22, 14]);
  });

  it("Priya draws 4 notches at slots 18, 12, 6, 0, with the inner ring", () => {
    const r = relief(PRIYA_HASH);
    expect(r.marks).toHaveLength(64);
    expect(r.coarse.signature).toBe("n4;s18;m1;r=inner");
    expect(r.coarse.notches.map((n) => n.slot)).toEqual([18, 12, 6, 0]);
  });

  it("the persona pairs differ in coarse features", () => {
    const maya = relief(MAYA_HASH);
    expect(coarseDifference(maya, relief(TOMAS_HASH))).toBeGreaterThanOrEqual(
      1,
    );
    expect(coarseDifference(maya, relief(PRIYA_HASH))).toBeGreaterThanOrEqual(
      1,
    );
  });
});

describe("blank input", () => {
  const bad: unknown[] = [
    undefined,
    null,
    42,
    "",
    "f7023f75",
    LANDING_HASH.slice(0, 63),
    `${LANDING_HASH}0`,
    LANDING_HASH.toUpperCase(),
    `${LANDING_HASH.slice(0, 63)}z`,
    ` ${LANDING_HASH.slice(1)}`,
    { hash: LANDING_HASH },
  ];

  it.each(bad.map((v, i) => [i, v] as const))(
    "input %i draws the Blank_Signet",
    (_i, value) => {
      expect(isFingerprintHex(value)).toBe(false);
      expect(sealRelief(value)).toEqual(BLANK_RELIEF);
    },
  );

  it("the blank relief has no coarse layer, no marks and no paths", () => {
    expect(BLANK_RELIEF.coarse).toBeNull();
    expect(BLANK_RELIEF.marks).toHaveLength(0);
    expect(BLANK_RELIEF.tickPath).toBe("");
    expect(BLANK_RELIEF.dotPath).toBe("");
    expect(reliefArt(BLANK_RELIEF).fine).toHaveLength(0);
  });
});

describe("path output", () => {
  it("contains only path commands and numbers, so no <text>, <image> or <use> can appear", () => {
    const r = relief(LANDING_HASH);
    const all = [r.tickPath, r.dotPath, r.coarse.notchPath].join(" ");
    expect(all).not.toMatch(/[<>]/);
    expect(all).toMatch(/^[MLAZ0-9.\- ]+$/);
  });

  it("the signature holds only counts and slots, as data-coarse will", () => {
    for (const hash of [LANDING_HASH, MAYA_HASH, TOMAS_HASH, PRIYA_HASH]) {
      const r = relief(hash);
      const ringName = ["inner", "outer", "both"][r.coarse.ringState];
      expect(r.coarse.signature).toBe(
        `n${r.coarse.notchCount};s${r.coarse.sum};m${r.coarse.mirror};r=${ringName}`,
      );
    }
  });

  it("the art reads its tones from the existing wax tokens", () => {
    const art = reliefArt(relief(MAYA_HASH));
    expect(art.rings.map((g) => g.tone)).toEqual(["press"]);
    expect(art.notches?.tone).toBe("eye");
    expect(art.fine.map((p) => p.tone)).toEqual(["rim", "rim"]);
  });
});

describe("source rules (G1.5)", () => {
  const files = ["./relief.ts", "./slot-vectors.ts"];
  const source = (name: string): string =>
    readFileSync(new URL(name, import.meta.url), "utf8");

  it.each(files)("%s makes no trig, random or Date calls", (name) => {
    const text = source(name);
    expect(text).not.toMatch(/Math\.random/);
    expect(text).not.toMatch(/Math\.sin|Math\.cos/);
    expect(text).not.toMatch(/\bDate\b/);
  });

  it.each(files)("%s imports only from this folder", (name) => {
    const imports = source(name).match(/from\s+["'][^"']+["']/g) ?? [];
    for (const line of imports) {
      expect(line).toMatch(/from\s+["']\.\/[^"']+["']/);
      expect(line).not.toMatch(/crypto|letter-store|\/db/);
    }
  });
});

describe("rasteriser (raster.testing.ts)", () => {
  it("a relief has no difference from itself", () => {
    const r = relief(MAYA_HASH);
    expect(pixelDifferencePercent(r, r, 96, "coarse")).toBe(0);
    expect(pixelDifferencePercent(r, r, 96, "full")).toBe(0);
  });

  it("reproduces the design measurements for the three persona pairs", () => {
    // design.md, Measured in this session: coarse difference, then coarse and full pixel difference at 96 px.
    const pairs = [
      [MAYA_HASH, TOMAS_HASH, 8, 5.78, 10.57],
      [MAYA_HASH, PRIYA_HASH, 11, 33.23, 30.45],
      [TOMAS_HASH, PRIYA_HASH, 7, 31.15, 28.82],
    ] as const;
    for (const [x, y, coarse, pixCoarse, pixFull] of pairs) {
      const a = relief(x);
      const b = relief(y);
      expect(coarseDifference(a, b)).toBe(coarse);
      expect(pixelDifferencePercent(a, b, 96, "coarse")).toBeCloseTo(
        pixCoarse,
        2,
      );
      expect(pixelDifferencePercent(a, b, 96, "full")).toBeCloseTo(pixFull, 2);
    }
  });
});
