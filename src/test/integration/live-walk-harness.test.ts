/**
 * Unit checks for the browser, container and box helpers in
 * `live-walk-helpers.ts`. They run without Chromium and without Docker: the
 * container path is refused before any docker call, and the box and name helpers are pure.
 */
import { describe, expect, it } from "vitest";

import {
  BOX_INSIDE_TOLERANCE_PX,
  checkRectInside,
  databaseCommandEnv,
  rectInside,
  removeTestPostgres,
  testContainerName,
  TEST_POSTGRES_IMAGE,
  type BoxRect,
} from "./live-walk-helpers";

const outer: BoxRect = { top: 100, right: 500, bottom: 300, left: 100 };

describe("rectInside", () => {
  it("accepts a box fully inside its container", () => {
    expect(
      rectInside({ top: 120, right: 480, bottom: 280, left: 120 }, outer),
    ).toBe(true);
  });

  it("accepts a box that touches an edge exactly", () => {
    expect(
      rectInside({ top: 100, right: 500, bottom: 300, left: 100 }, outer),
    ).toBe(true);
  });

  it("allows subpixel rounding within the tolerance", () => {
    const slightly = { top: 99.6, right: 500.4, bottom: 300, left: 100 };
    expect(BOX_INSIDE_TOLERANCE_PX).toBe(0.5);
    expect(rectInside(slightly, outer)).toBe(true);
  });

  it("rejects a box that pokes out on each side", () => {
    expect(
      rectInside({ top: 90, right: 480, bottom: 280, left: 120 }, outer),
    ).toBe(false);
    expect(
      rectInside({ top: 120, right: 510, bottom: 280, left: 120 }, outer),
    ).toBe(false);
    expect(
      rectInside({ top: 120, right: 480, bottom: 310, left: 120 }, outer),
    ).toBe(false);
    expect(
      rectInside({ top: 120, right: 480, bottom: 280, left: 90 }, outer),
    ).toBe(false);
  });

  it("rejects a box fully outside its container", () => {
    expect(
      rectInside({ top: 400, right: 480, bottom: 450, left: 120 }, outer),
    ).toBe(false);
  });

  it("rejects an empty box, which is not visible", () => {
    expect(
      rectInside({ top: 120, right: 120, bottom: 280, left: 120 }, outer),
    ).toBe(false);
    expect(
      rectInside({ top: 150, right: 480, bottom: 150, left: 120 }, outer),
    ).toBe(false);
  });
});

describe("checkRectInside", () => {
  it("passes with a PASS message that names the element", () => {
    const check = checkRectInside(
      "Ghost",
      { top: 120, right: 480, bottom: 280, left: 120 },
      outer,
    );
    expect(check.ok).toBe(true);
    expect(check.message).toBe("PASS Ghost sits fully inside its container");
  });

  it("fails and shows both boxes when the element pokes out", () => {
    const inner = { top: 120, right: 600, bottom: 280, left: 120 };
    const check = checkRectInside("Ghost", inner, outer);
    expect(check.ok).toBe(false);
    expect(check.message).toContain("Ghost is not fully inside its container");
    expect(check.message).toContain(JSON.stringify(inner));
    expect(check.message).toContain(JSON.stringify(outer));
  });
});

describe("testContainerName", () => {
  it("names the container so the remover accepts it", () => {
    const name = testContainerName();
    expect(name).toMatch(/^revenant-test-pg-[0-9a-f]{8}$/);
    expect(name).toContain("test");
  });

  it("gives a different name each time", () => {
    expect(testContainerName()).not.toBe(testContainerName());
  });
});

describe("removeTestPostgres", () => {
  it("refuses a container name without 'test' before calling docker", async () => {
    await expect(removeTestPostgres("revenant-pg-prod")).rejects.toThrow(
      /must contain "test"/,
    );
  });
});

describe("databaseCommandEnv", () => {
  it("returns a copy with DATABASE_URL and leaves process.env untouched", () => {
    const url = "postgres://postgres:secret@127.0.0.1:5999/revenant";
    const env = databaseCommandEnv(url);
    expect(env.DATABASE_URL).toBe(url);
    expect(process.env.DATABASE_URL).not.toBe(url);
  });
});

describe("TEST_POSTGRES_IMAGE", () => {
  it("uses the Postgres major version the Helm chart deploys", () => {
    expect(TEST_POSTGRES_IMAGE).toBe("postgres:17-alpine");
  });
});
