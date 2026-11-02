// Server-only time rules for Live_Letters.
//
// Both functions take the server clock `now` as an argument. They never read a
// clock themselves, so the caller decides which clock is authoritative (the
// database `clock_timestamp()` read in the seal or prepare transaction).
//
// This module must never be imported by browser code. The guard below throws
// if it is bundled into a client component, matching `clock.ts`.
import {
  DRAFT_LIFETIME_MS,
  LOCK_DURATION_MS,
  LOCK_MAX_AHEAD_MS,
} from "@/lib/seal-format/live-constants";

if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/letter-store/live-rules.ts is server-only and must not be imported in the browser.",
  );
}

/**
 * Check the Lock rule for a Live_Letter.
 *
 * True only when all three hold:
 * - `opensAt - sealedAt` is exactly LOCK_DURATION_MS,
 * - `opensAt` is after the server time `now`,
 * - `opensAt - now` is at most LOCK_MAX_AHEAD_MS.
 */
export function lockRuleHolds(
  sealedAt: Date,
  opensAt: Date,
  now: Date,
): boolean {
  const sealed = sealedAt.getTime();
  const opens = opensAt.getTime();
  const current = now.getTime();
  return (
    opens - sealed === LOCK_DURATION_MS &&
    opens > current &&
    opens - current <= LOCK_MAX_AHEAD_MS
  );
}

/**
 * Check that a draft is still fresh: `0 <= now - createdAt < DRAFT_LIFETIME_MS`.
 *
 * The lower bound rejects a draft created after `now`. The upper bound is
 * strict, so a draft exactly DRAFT_LIFETIME_MS old is stale.
 */
export function draftIsFresh(createdAt: Date, now: Date): boolean {
  const age = now.getTime() - createdAt.getTime();
  return age >= 0 && age < DRAFT_LIFETIME_MS;
}
