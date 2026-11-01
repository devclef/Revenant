// Unit tests for readRpId: trims RP_ID and returns null when it is empty.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readRpId } from "./config";

describe("readRpId", () => {
  const saved = process.env.RP_ID;

  beforeEach(() => {
    delete process.env.RP_ID;
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.RP_ID;
    else process.env.RP_ID = saved;
  });

  it("returns null when RP_ID is unset", () => {
    expect(readRpId()).toBeNull();
  });

  it("returns null when RP_ID is empty or only whitespace", () => {
    process.env.RP_ID = "";
    expect(readRpId()).toBeNull();
    process.env.RP_ID = "   ";
    expect(readRpId()).toBeNull();
  });

  it("returns the trimmed value", () => {
    process.env.RP_ID = "  revenant.devclef.se \n";
    expect(readRpId()).toBe("revenant.devclef.se");
  });
});
