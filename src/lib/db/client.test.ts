import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDatabaseUrl } from "./client";

// These tests cover the "DATABASE_URL is never logged / never leaked"
// acceptance criterion without a live database: getDatabaseUrl is the single
// place the value is read, and it must throw a clear, value-free error when the
// variable is missing. No postgres connection is opened here.
describe("getDatabaseUrl", () => {
  const original = process.env.DATABASE_URL;

  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = original;
    }
  });

  it("throws a clear error when DATABASE_URL is unset", () => {
    expect(() => getDatabaseUrl()).toThrow(/DATABASE_URL is not set/);
  });

  it("throws when DATABASE_URL is an empty string", () => {
    process.env.DATABASE_URL = "";
    expect(() => getDatabaseUrl()).toThrow(/DATABASE_URL is not set/);
  });

  it("does not leak a connection string value in the thrown error", () => {
    // A realistic value with credentials. If getDatabaseUrl ever echoed the
    // value into its error, this would catch it. The variable is deleted in
    // beforeEach, so the error path under test is the "unset" one, and the
    // message must never contain anything resembling a connection string.
    const secret = "postgres://user:s3cr3t-password@db.example.com:5432/revenant";
    let message = "";
    try {
      getDatabaseUrl();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).not.toBe("");
    expect(message).not.toContain(secret);
    expect(message).not.toContain("s3cr3t-password");
    expect(message).not.toContain("postgres://");
  });

  it("returns the value when DATABASE_URL is set", () => {
    process.env.DATABASE_URL = "postgres://localhost:5432/revenant";
    expect(getDatabaseUrl()).toBe("postgres://localhost:5432/revenant");
  });
});
