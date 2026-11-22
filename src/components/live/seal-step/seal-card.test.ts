import { describe, expect, it } from "vitest";

import { hasPrimaryCard, stepForStage } from "../stepper/live-steps";

describe("hasPrimaryCard", () => {
  it("is true for the write step", () => {
    expect(hasPrimaryCard("write")).toBe(true);
  });

  it("is false for the seal step", () => {
    expect(hasPrimaryCard("seal")).toBe(false);
  });

  it("is true for the wait step", () => {
    expect(hasPrimaryCard("wait")).toBe(true);
  });

  it("is false for the testify, break and receipts steps", () => {
    expect(hasPrimaryCard("testify")).toBe(false);
    expect(hasPrimaryCard("break")).toBe(false);
    expect(hasPrimaryCard("receipts")).toBe(false);
  });
});

describe("stage thresholds", () => {
  it("still map the reveal stages to the break and receipts steps", () => {
    expect(stepForStage("marks")).toBe("break");
    expect(stepForStage("seal")).toBe("break");
    expect(stepForStage("letter")).toBe("receipts");
    expect(stepForStage("figures")).toBe("receipts");
    expect(stepForStage("close")).toBe("receipts");
    expect(stepForStage("emerging")).toBeNull();
  });
});
