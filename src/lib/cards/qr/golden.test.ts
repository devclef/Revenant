import { describe, expect, it } from "vitest";
import vectors from "./__fixtures__/vectors.json";
import { encodeQr } from "./encode";
import { assertFunctionPatterns, readBack, readFormatInfo, type Modules } from "./test-support";

const toModules = (rows: string[]): boolean[][] => rows.map((row) => [...row].map((c) => c === "1"));

describe("golden QR vectors from the reference encoder", () => {
  it("records the tool that made them", () => {
    expect(vectors.generator.tool).toBe("qrencode");
    expect(vectors.generator.toolVersion).toBe("4.1.1");
  });

  for (const vector of vectors.vectors) {
    describe(`"${vector.text.slice(0, 24)}..." (version ${vector.version}, level ${vector.level})`, () => {
      const modules: Modules = toModules(vector.matrix);

      it("has the side length and patterns for its version", () => {
        expect(modules.length).toBe(vector.size);
        assertFunctionPatterns(modules, vector.version);
      });

      it("decodes its format information to level M", () => {
        expect(readFormatInfo(modules).level).toBe(vector.level);
      });

      it("reads back the input text", () => {
        expect(readBack(modules)).toBe(vector.text);
      });

      it("is the same symbol our encoder produces", () => {
        const ours = encodeQr(vector.text, "M");
        expect(ours.version).toBe(vector.version);
        expect(ours.modules).toEqual(modules);
      });
    });
  }
});
