import type { NextResponse } from "next/server";

import { figuresSourceMode } from "./build-response";
import { getFigureReadStore } from "./db-store";
import { respondFigures } from "./respond";

/**
 * GET /api/figures (spec 08-judge-polish, Property 23).
 *
 * Lists every Catalogue series with its metric definition, period type,
 * Last_Success_Time and latest figure. The body is the same for every visitor
 * and names no letter. It reads no query parameter, so `?metric=` and any
 * other query string are ignored.
 *
 * FIGURES_SOURCE is read per request. `db` (the default) answers from the
 * `figures` and `figure_fetch_runs` tables. `file` answers from the bundled
 * `fuel-figures.json` and `fetch-status.json`, the Fallback_Refresh backend.
 */

// Read FIGURES_SOURCE at request time, not at build time.
export const dynamic = "force-dynamic";

// Takes no request argument: the handler never reads the URL, so no query
// string can change the body.
export async function GET(): Promise<NextResponse> {
  return respondFigures(figuresSourceMode(process.env.FIGURES_SOURCE), {
    readStore: getFigureReadStore,
    now: () => new Date(),
  });
}
