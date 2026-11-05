// Browser-side time for the Seal_Page (spec 06-lock-and-unlock, design.md
// "Server clock and time rules"). The server clock decides; these values only
// set the sealedAt and opensAt the header carries and draw the countdown.
// Pure module: no I/O.

import { LOCK_DURATION_MS } from "@/lib/seal-format/live-constants";

export interface SealTimes {
  offsetMs: number;
  sealedAt: string;
  opensAt: string;
}

/**
 * Corrects the browser clock with the offset between the server's time from
 * the prepare response and the browser's clock at arrival (R15.5).
 *
 * offsetMs = serverNow - arrivedMs
 * sealedAt = nowMs + offsetMs
 * opensAt  = sealedAt + LOCK_DURATION_MS
 *
 * Both times are millisecond-precision UTC ISO strings.
 */
export function computeSealTimes(args: {
  serverNow: string;
  arrivedMs: number;
  nowMs: number;
}): SealTimes {
  const offsetMs = Date.parse(args.serverNow) - args.arrivedMs;
  const sealedAt = new Date(args.nowMs + offsetMs).toISOString();
  const opensAt = new Date(Date.parse(sealedAt) + LOCK_DURATION_MS).toISOString();
  return { offsetMs, sealedAt, opensAt };
}

/**
 * Whole seconds left until opensAt, drawn from the browser clock corrected by
 * offsetMs (R16.2). Display only: it never decides whether a letter opens.
 * Never negative. Zero once the corrected clock reaches opensAtMs.
 */
export function remainingSeconds(opensAtMs: number, nowMs: number, offsetMs: number): number {
  return Math.max(0, Math.ceil((opensAtMs - (nowMs + offsetMs)) / 1000));
}

/**
 * Whether the "Go to your letter" control may be enabled (R16.3 to R16.5).
 * True only once the countdown has ended: the corrected browser clock has
 * reached opensAtMs. Any non-finite input (a bad opensAt, or a clock or offset
 * that is NaN or infinite) gives false, so the control stays disabled. The
 * server still decides whether the letter opens; this only decides the link.
 */
export function goToLetterReady(opensAtMs: number, nowMs: number, offsetMs: number): boolean {
  if (!Number.isFinite(opensAtMs) || !Number.isFinite(nowMs) || !Number.isFinite(offsetMs)) {
    return false;
  }
  return remainingSeconds(opensAtMs, nowMs, offsetMs) === 0;
}
