import { afterEach, beforeEach, describe, expect, it } from "vitest";
import pkg from "../../package.json";
import { getVersion } from "./version";

describe("getVersion", () => {
  const original = process.env.APP_VERSION;

  beforeEach(() => {
    delete process.env.APP_VERSION;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.APP_VERSION;
    } else {
      process.env.APP_VERSION = original;
    }
  });

  it("falls back to the package.json version when APP_VERSION is unset", () => {
    expect(getVersion()).toBe(pkg.version);
  });

  it("returns APP_VERSION when it is set", () => {
    process.env.APP_VERSION = "9.9.9-test";
    expect(getVersion()).toBe("9.9.9-test");
  });
});
