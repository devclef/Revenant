// isRpId is the rpId rule extracted from the header schema (design.md, Seal
// changes). These cases pin the accepted and refused hostnames.

import { describe, expect, it } from "vitest";
import { isRpId } from "./header";

describe("isRpId", () => {
  it("accepts lowercase hostnames and localhost", () => {
    for (const s of [
      "localhost",
      "revenant.devclef.se",
      "a",
      "a-b.example.com",
      "x1.y2",
    ]) {
      expect(isRpId(s)).toBe(true);
    }
  });

  it("refuses uppercase, empty, ports, paths and bad labels", () => {
    for (const s of [
      "",
      "Revenant.devclef.se",
      "revenant.devclef.se:443",
      "https://revenant.devclef.se",
      "rev/enant",
      "-bad.example",
      "bad-.example",
      "double..dot",
      "under_score.example",
      "a".repeat(64) + ".example",
      "a".repeat(254),
    ]) {
      expect(isRpId(s)).toBe(false);
    }
  });
});
