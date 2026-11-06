// Feature: 09-demo-polish (landing hero, Constants table)
//
// Pins the landing constants to design.md "Constants", and checks that
// landing.module.css repeats the same values.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import * as C from "./constants";

const CSS = readFileSync(
  join(fileURLToPath(new URL(".", import.meta.url)), "landing.module.css"),
  "utf8",
);

describe("landing constants", () => {
  it("holds the design values", () => {
    expect(C.PHONE_BELOW_PX).toBe(600);
    expect(C.LANDING_GHOST_PHONE_MAX_PX).toBe(190);
    expect(C.DEAD_SPACE_MAX_PX).toBe(64);
    expect(C.TOUCH_TARGET_MIN_PX).toBe(44);
    expect(C.LANDING_WIDE_MIN_PX).toBe(1920);
  });

  it("does not define FLOW_MINUTES until the owner's B1.7 timings are known", () => {
    expect(C).not.toHaveProperty("FLOW_MINUTES");
  });

  it("uses the same breakpoints in the stylesheet", () => {
    expect(CSS).toContain(`@media (min-width: ${C.LANDING_WIDE_MIN_PX}px)`);
    expect(CSS).toContain("@media (min-width: 600px)");
  });

  it("uses the same ghost cap in the stylesheet", () => {
    expect(CSS).toContain(`min(30svh, ${C.LANDING_GHOST_PHONE_MAX_PX}px)`);
  });

  it("uses the same touch target as a minimum size in the stylesheet", () => {
    // The CTA minimum height is 3.5rem (56 px), which is at least 44 px.
    expect(CSS).toContain("min-height: 3.5rem;");
    expect(3.5 * 16).toBeGreaterThanOrEqual(C.TOUCH_TARGET_MIN_PX);
  });
});
