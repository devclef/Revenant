// Server-only clock decision helper for the letter routes.
//
// `isOpenable` is the single pure function the routes use to decide whether a
// letter's opening date has arrived. It reads no client clock and no ambient
// time: the caller passes both the letter's `opensAt` and the database `now()`
// (read in the same parameterised statement as the letter row), so the decision
// is made against the server's authoritative clock only.
//
// R6.5: equal-to-the-millisecond counts as open, so the comparison is `>=`.
//
// Import boundary: this module imports nothing. It never imports `@/lib/crypto`;
// it holds no key material and performs no cryptography, only a time comparison.
// The `crypto.md` import-boundary test enforces this.
//
// This module must never be imported by browser code. The guard below throws if
// it is bundled into a client component, matching `lib/db/client.ts` and
// `lib/letter-store/store.ts`.
if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/letter-store/clock.ts is server-only and must not be imported in the browser.",
  );
}

/**
 * Decide whether a letter is openable at a given moment.
 *
 * Returns `true` when `now` is at or after `opensAt`. Equality counts as open
 * (R6.5: a letter whose opening date equals the current instant to the
 * millisecond is open), so the comparison uses `>=`.
 *
 * Pure: it reads only its two arguments and depends on no ambient clock. The
 * routes pass the database `now()` as `now`, never a client-supplied time.
 *
 * @param opensAt The letter's opening date.
 * @param now The authoritative current time (the database `now()`).
 * @returns `true` if the letter is open, `false` if it is still sealed.
 */
export function isOpenable(opensAt: Date, now: Date): boolean {
  return now.getTime() >= opensAt.getTime();
}
