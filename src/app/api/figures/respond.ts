// Answers GET /api/figures in either source mode (spec 08-judge-polish, design
// "The Figures_API"). It lives outside route.ts because a Next.js route module
// may export only route fields, and the tests need to drive this with their own
// read store.
//
// Failure rule (design, "Error Handling"): if the database read fails in db mode,
// the response is 500 with a neutral body and no-store. It never returns a partial
// list, and it never falls back to the bundled file.

import { NextResponse } from "next/server";

import { CATALOGUE } from "@/lib/figures/catalogue";
import { DEMO_FIGURES } from "@/lib/figures/demo";
import type { FiguresResponseV1 } from "@/lib/figures/now";
import fetchStatus from "@/lib/figures/real/fetch-status.json";

import { buildFiguresResponse, type FiguresSourceMode } from "./build-response";
import { buildDbFiguresResponse, type FigureReadStore } from "./db-response";

export const FIGURES_CACHE_CONTROL =
  "public, max-age=600, stale-while-revalidate=3600";

export interface FiguresRequestDeps {
  /** Called only in db mode, inside the error boundary, so a missing DATABASE_URL is a 500. */
  readStore: () => FigureReadStore;
  /** The server clock, read once per request for `generated_at`. */
  now: () => Date;
}

export async function respondFigures(
  mode: FiguresSourceMode,
  deps: FiguresRequestDeps,
): Promise<NextResponse> {
  const generatedAt = deps.now().toISOString().replace(/\.\d{3}Z$/, "Z");

  let body: FiguresResponseV1;
  try {
    body =
      mode === "db"
        ? await buildDbFiguresResponse(deps.readStore(), CATALOGUE, generatedAt)
        : buildFiguresResponse({
            loaded: DEMO_FIGURES,
            catalogue: CATALOGUE,
            fetchStatus,
            sourceMode: "file",
            generatedAt,
          });
  } catch {
    // The underlying error is discarded: it may carry the connection string.
    return NextResponse.json(
      { error: "figures_unavailable" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(body, {
    status: 200,
    headers: { "Cache-Control": FIGURES_CACHE_CONTROL },
  });
}
