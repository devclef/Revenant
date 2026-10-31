import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

// A realistic connection string with credentials. If any code path ever echoed
// the value into the readiness-probe error, the assertions below would catch
// it. No real connection is ever opened: the postgres module is mocked.
const SECRET_URL =
  "postgres://user:s3cr3t-password@db.example.com:5432/revenant";

// Cover the "answers within ~2 s, leaks no error details" acceptance criterion
// for the readiness probe without a live database. The postgres client is
// mocked so the `select 1` tagged-template call never resolves; fake timers let
// us prove checkDatabaseConnection() gives up at its bound rather than hanging.
describe("checkDatabaseConnection timeout", () => {
  const original = process.env.DATABASE_URL;

  beforeEach(() => {
    process.env.DATABASE_URL = SECRET_URL;
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
    if (original === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = original;
    }
  });

  it("rejects with a value-free message within ~2 s when the query never resolves", async () => {
    // The probe calls `sql`select 1``. Make the tagged-template call return a
    // promise that never settles, so only the timeout can resolve the race.
    const neverResolves = () => new Promise(() => {});
    vi.doMock("postgres", () => ({
      default: vi.fn(() => neverResolves),
    }));

    const { checkDatabaseConnection } = await import("./client");

    const promise = checkDatabaseConnection();
    // Attach a catch synchronously so the rejection is never unhandled while we
    // advance the fake clock.
    const settled = promise.then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error }),
    );

    // Nothing should settle before the bound.
    await vi.advanceTimersByTimeAsync(1999);
    // Advancing past ~2 s must make the probe give up.
    await vi.advanceTimersByTimeAsync(2);

    const result = await settled;
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected checkDatabaseConnection to reject");
    }
    const message =
      result.error instanceof Error
        ? result.error.message
        : String(result.error);
    expect(message).toBe("Database connection check failed.");
    // The rejection must never carry the connection string.
    expect(message).not.toContain(SECRET_URL);
    expect(message).not.toContain("s3cr3t-password");
    expect(message).not.toContain("postgres://");
  });

  it("rejects with the same value-free message when the query throws", async () => {
    // A failing query (e.g. connection refused) must surface the same
    // value-free error, never the underlying driver error that may embed the
    // connection string.
    const throwsSecret = () =>
      Promise.reject(new Error(`connect ECONNREFUSED ${SECRET_URL}`));
    vi.doMock("postgres", () => ({
      default: vi.fn(() => throwsSecret),
    }));

    const { checkDatabaseConnection } = await import("./client");

    await expect(checkDatabaseConnection()).rejects.toThrow(
      "Database connection check failed.",
    );
    // Prove the thrown error does not leak the underlying driver message.
    try {
      await checkDatabaseConnection();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toBe("Database connection check failed.");
      expect(message).not.toContain(SECRET_URL);
      expect(message).not.toContain("s3cr3t-password");
    }
  });
});
