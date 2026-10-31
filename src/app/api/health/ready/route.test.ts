import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the db client so no real Postgres connection is opened, matching the
// no-live-DB style in src/lib/db/client.test.ts. Only checkDatabaseConnection
// is exercised by the route; it is replaced per-test below.
const checkDatabaseConnection = vi.fn();
vi.mock("@/lib/db/client", () => ({
  checkDatabaseConnection: () => checkDatabaseConnection(),
}));

// Import after the mock is registered so the route binds to the mocked helper.
import { GET } from "./route";

describe("GET /api/health/ready", () => {
  beforeEach(() => {
    checkDatabaseConnection.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 { status: 'ready' } with no-store when the DB check resolves", async () => {
    checkDatabaseConnection.mockResolvedValue(true);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ status: "ready" });
  });

  it("returns 503 { status: 'unavailable' } with no-store when the DB check rejects", async () => {
    checkDatabaseConnection.mockRejectedValue(
      new Error("Database connection check failed."),
    );

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ status: "unavailable" });
  });

  it("never leaks a connection string in the 503 body when the DB check rejects", async () => {
    // If the route ever forwarded the underlying driver error (which may embed
    // DATABASE_URL) into the response, this would catch it. The rejection
    // carries a realistic connection string to prove it is discarded.
    const secret =
      "postgres://user:s3cr3t-password@db.example.com:5432/revenant";
    checkDatabaseConnection.mockRejectedValue(new Error(secret));

    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).not.toContain(secret);
    expect(body).not.toContain("s3cr3t-password");
    expect(body).not.toContain("postgres://");
    expect(body).toContain("unavailable");
  });

  it("returns 503 { status: 'unavailable' } with no-store when the DB check times out", async () => {
    // The ~2 s bound in checkDatabaseConnection rejects with a value-free
    // timeout error when Postgres hangs. The route must treat that exactly like
    // any other rejection: 503, no-store, no leaked detail. The mock stands in
    // for the timed-out check so no real connection is opened and the test does
    // not wait the real bound.
    checkDatabaseConnection.mockRejectedValue(
      new Error("Database connection check failed."),
    );

    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(JSON.parse(body)).toEqual({ status: "unavailable" });
    // The value-free timeout error must never reach the client body.
    expect(body).not.toContain("Database connection check failed");
  });
});
