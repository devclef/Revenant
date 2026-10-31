import { describe, expect, it } from "vitest";

import { getVersion } from "@/lib/version";

import { GET } from "./route";

describe("GET /api/health", () => {
  it("returns 200 with the ok status and the app version", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      version: getVersion(),
    });
  });

  it("sets Cache-Control to no-store", () => {
    const response = GET();

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
