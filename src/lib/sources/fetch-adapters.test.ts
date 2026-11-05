// Tests for the Fetch_Job's adapter wiring (spec 08-judge-polish, task 16; design.md
// "The daily figure fetch", "Adapters"). Every download goes through a stub
// fetcher that answers 500, so no test touches the network, and the failure
// reasons prove which requests were made.

import { describe, expect, it } from "vitest";

import { CATALOGUE } from "@/lib/figures";

import { createFetchAdapters } from "./fetch-adapters";
import { failureReason } from "./fetch-job";
import type { FetchResult } from "./types";

/** A fetcher that answers every request with HTTP 500 and records each URL. */
function failingFetcher(): { urls: string[]; fetcher: (url: string) => Promise<FetchResult> } {
  const urls: string[] = [];
  return {
    urls,
    fetcher: async (url: string): Promise<FetchResult> => {
      urls.push(url);
      return { status: 500, url, body: new Uint8Array([0]) };
    },
  };
}

function hostOf(url: string): string {
  return new URL(url).host;
}

describe("createFetchAdapters", () => {
  it("has one adapter per Catalogue series", () => {
    const adapters = createFetchAdapters({ fetcher: failingFetcher().fetcher });

    expect(Object.keys(adapters).sort()).toEqual(
      CATALOGUE.map((c) => c.metric.id).sort(),
    );
  });

  it("downloads each EIA series from the EIA host, and a failure keeps its reason token", async () => {
    const stub = failingFetcher();
    const adapters = createFetchAdapters({ fetcher: stub.fetcher });

    const adapter = adapters["us-gasoline-regular"];
    const outcome = await adapter().then(
      () => null,
      (err: unknown) => err,
    );

    expect(failureReason(outcome)).toBe("http 500");
    expect(stub.urls).toHaveLength(1);
    expect(hostOf(stub.urls[0])).toBe("www.eia.gov");
    expect(stub.urls[0]).toContain("EMM_EPMR_PTE_NUS_DPG");
  });

  it("makes one Weekly Oil Bulletin download for both EU series", async () => {
    const stub = failingFetcher();
    const adapters = createFetchAdapters({ fetcher: stub.fetcher });

    const results = await Promise.allSettled([
      adapters["eu-petrol-euro95"](),
      adapters["eu-diesel"](),
    ]);

    expect(results.map((r) => r.status)).toEqual(["rejected", "rejected"]);
    // The page request failed, so the workbook was never requested, and the two
    // series share the one request made.
    expect(stub.urls).toHaveLength(1);
    expect(hostOf(stub.urls[0])).toBe("energy.ec.europa.eu");
  });

  it("reuses one run's download when the same EIA series is read twice", async () => {
    const stub = failingFetcher();
    const adapters = createFetchAdapters({ fetcher: stub.fetcher });

    await Promise.allSettled([adapters["us-diesel"](), adapters["us-diesel"]()]);

    expect(stub.urls).toHaveLength(1);
  });
});
