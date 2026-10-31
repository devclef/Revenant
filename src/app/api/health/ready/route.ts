import { NextResponse } from "next/server";

import { checkDatabaseConnection } from "@/lib/db/client";

/**
 * Readiness probe.
 *
 * Confirms the database is reachable with a trivial `SELECT 1`. Returns 200
 * `{ status: "ready" }` when the check succeeds and 503
 * `{ status: "unavailable" }` when it fails. The failure response carries no
 * driver error detail and never the connection string: `checkDatabaseConnection`
 * throws a value-free error, and nothing from it is forwarded to the client.
 * This route is what the CI smoke job probes at `/api/health/ready`.
 */

// Never statically cache: the probe must reflect the live database state, and
// every response carries `Cache-Control: no-store` to match.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(): Promise<NextResponse> {
  try {
    await checkDatabaseConnection();
    return NextResponse.json(
      { status: "ready" },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return NextResponse.json(
      { status: "unavailable" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
