// Feature: 07-judge-journey (spec 07 task 4)
//
// The Pick_Up_Button guard (R10.6): one BEGIN per `verified`, and the guard
// re-arms when the flow leaves `verified`.

import { describe, expect, it } from "vitest";

import { createBeginGuard } from "./begin-guard";

describe("createBeginGuard (R10.6)", () => {
  it("sends one BEGIN for a double click", () => {
    let sends = 0;
    const guard = createBeginGuard(() => {
      sends += 1;
    });
    guard.begin();
    guard.begin();
    expect(sends).toBe(1);
  });

  it("sends again only after a reset, which is when the flow leaves verified", () => {
    let sends = 0;
    const guard = createBeginGuard(() => {
      sends += 1;
    });
    guard.begin();
    guard.reset();
    guard.begin();
    guard.begin();
    expect(sends).toBe(2);
  });

  it("sends nothing before the first begin", () => {
    let sends = 0;
    createBeginGuard(() => {
      sends += 1;
    });
    expect(sends).toBe(0);
  });
});
