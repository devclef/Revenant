import { NextResponse } from "next/server";

import { getVersion } from "@/lib/version";

/**
 * Liveness/readiness probe.
 *
 * Returns the app version so a deploy can confirm which image is running.
 * This route is a liveness probe only: it touches no letter data and no
 * database. It must never import `lib/db`, Drizzle, or any data module.
 */

// Never statically cache: the probe must reflect the running process, and the
// response carries `Cache-Control: no-store` to match.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export function GET(): NextResponse {
  return NextResponse.json(
    { status: "ok", version: getVersion() },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
