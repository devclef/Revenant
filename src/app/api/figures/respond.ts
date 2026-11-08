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
import {
  readDbFigures,
  shapeDbFiguresResponse,
  type FigureReadStore,
} from "./db-response";

/** The step that failed: the database or file read, or the response shaping. */
type FiguresStep = "read" | "shape";

/**
 * The one diagnostic line for a failed request. It holds the step, the error's
 * name and, only when it is a string, the Postgres code. It never holds the
 * message, stack, cause or any request or header value, because the message may
 * carry the connection string.
 */
export function figuresFailureLine(step: FiguresStep, err: unknown): string {
  const name = err instanceof Error ? err.name : typeof err;
  const code =
    typeof err === "object" && err !== null && "code" in err ? err.code : undefined;
  const codePart = typeof code === "string" ? ` code=${code}` : "";
  return `figures_unavailable step=${step} error=${name}${codePart}`;
}

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
  let step: FiguresStep = "read";
  try {
    if (mode === "db") {
      step = "read";
      const reads = await readDbFigures(deps.readStore());
      step = "shape";
      body = shapeDbFiguresResponse(reads, CATALOGUE, generatedAt);
    } else {
      step = "shape";
      body = buildFiguresResponse({
        loaded: DEMO_FIGURES,
        catalogue: CATALOGUE,
        fetchStatus,
        sourceMode: "file",
        generatedAt,
      });
    }
  } catch (err) {
    // Only the step, error name and Postgres code are logged. The message is
    // dropped: it may carry the connection string.
    console.error(figuresFailureLine(step, err));
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
