import { NextResponse } from "next/server";

import { CATALOGUE } from "@/lib/figures/catalogue";
import { DEMO_FIGURES } from "@/lib/figures/demo";
import fetchStatus from "@/lib/figures/real/fetch-status.json";

import {
  buildFiguresResponse,
  figuresSourceMode,
} from "./build-response";

/**
 * GET /api/figures (spec 08-judge-polish, Property 23).
 *
 * Lists every Catalogue series with its metric definition, period type,
 * Last_Success_Time and latest figure. The body is the same for every visitor
 * and names no letter. It reads no query parameter, so `?metric=` and any
 * other query string are ignored.
 *
 * FIGURES_SOURCE is read per request. This task ships file mode only: `db`
 * mode answers from the same bundled figures until the database backend lands
 * (spec 08, task 16), and the body's `source_mode` still reports `db` then.
 */

// Read FIGURES_SOURCE at request time, not at build time.
export const dynamic = "force-dynamic";

// Takes no request argument: the handler never reads the URL, so no query
// string can change the body.
export function GET(): NextResponse {
  const body = buildFiguresResponse({
    loaded: DEMO_FIGURES,
    catalogue: CATALOGUE,
    fetchStatus,
    sourceMode: figuresSourceMode(process.env.FIGURES_SOURCE),
    generatedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  });

  return NextResponse.json(body, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=600, stale-while-revalidate=3600",
    },
  });
}
