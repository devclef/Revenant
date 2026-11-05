// The Fetch_Job's adapters (spec 08-judge-polish, task 16; design.md "The daily
// figure fetch", "Adapters"). One SeriesAdapter per Catalogue metric, built on the
// same functions runPrefetch uses (`fetchEiaSeries`, `fetchBulletin`) and the same
// reference URLs (`SOURCE_URL`), so a figure carries the same provenance whichever
// entry point fetched it.
//
// The two EU series come from one Weekly Oil Bulletin download. Each download is
// made once per createFetchAdapters() call, which is once per run, and both
// series read from that one result. A failed download fails both EU series with
// the same error, as it does in runPrefetch.
//
// Pure module: it reads no environment variable and logs nothing. Each request
// uses the downloader's own 30 s limit (FETCH_TIMEOUT_MS in fetcher.ts).
// It fills no gap, converts no currency and substitutes no series (R20.13).

import { fetchEiaSeries, type EiaResult } from "./eia";
import type { SeriesAdapter } from "./fetch-job";
import { fetchBulletin, type BulletinResult } from "./oil-bulletin";
import { BULLETIN_SERIES, EIA_SERIES, SOURCE_URL } from "./prefetch";
import type { FreshSeries } from "./refresh";
import type { AdapterDeps } from "./types";

/**
 * One adapter per Catalogue metric id that this job downloads. `deps.fetcher` and
 * `deps.now` are passed to the publisher functions, so tests drive every request
 * with a stub and no network is touched.
 */
export function createFetchAdapters(
  deps: AdapterDeps = {},
): Record<string, SeriesAdapter> {
  const eiaBySeriesId = new Map<string, Promise<EiaResult>>();
  let bulletin: Promise<BulletinResult> | undefined;

  const eiaOnce = (seriesId: string): Promise<EiaResult> => {
    let pending = eiaBySeriesId.get(seriesId);
    if (pending === undefined) {
      pending = fetchEiaSeries(seriesId, deps);
      eiaBySeriesId.set(seriesId, pending);
    }
    return pending;
  };

  const bulletinOnce = (): Promise<BulletinResult> => {
    if (bulletin === undefined) bulletin = fetchBulletin(deps);
    return bulletin;
  };

  const adapters: Record<string, SeriesAdapter> = {};

  for (const { metricId, seriesId } of EIA_SERIES) {
    adapters[metricId] = async (): Promise<FreshSeries> => {
      const download = await eiaOnce(seriesId);
      return {
        metricId,
        points: download.result.points,
        downloadedAt: download.downloadedAt,
        sourceUrl: SOURCE_URL[metricId],
      };
    };
  }

  for (const { metricId, key } of BULLETIN_SERIES) {
    adapters[metricId] = async (): Promise<FreshSeries> => {
      const download = await bulletinOnce();
      return {
        metricId,
        points: download.series[key].points,
        downloadedAt: download.downloadedAt,
        sourceUrl: SOURCE_URL[metricId],
      };
    };
  }

  return adapters;
}
