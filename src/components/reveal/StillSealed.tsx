"use client";

import { useEffect, useRef, useState } from "react";
import paper from "@/components/ui/paper.module.css";
import {
  browserTimeZone,
  formatLetterDate,
  letterZoneFor,
  type LetterZone,
} from "@/components/ui/letter-date";
import { REVEAL_COPY } from "./copy";
import styles from "./reveal.module.css";

/**
 * The still-sealed view (R7.2). Shown when the letter exists but has not opened
 * yet: `GET /api/letters/{id}` returned `sealed`, or the secret route returned
 * 403. It reveals nothing about the contents -- only the opening date and the
 * time remaining, in Revenant's voice (tone.md: "an envelope on a mantelpiece").
 *
 * The opening instant (`opensAt`) is a UTC `Z` string from the server. The
 * displayed date comes from the one letter-date module in the letter's own zone
 * (spec 08 R15.1): a persona countdown shows the date in UTC; a live letter
 * (the `precise` countdown) shows it in the browser's own zone, the zone it was
 * sealed in. Either way the date reads the same for every viewer in that zone.
 *
 * The countdown is a DISPLAY-ONLY convenience driven by the browser clock. The
 * client clock never decides whether the letter may open (crypto.md: "The
 * client clock never decides"). When the browser clock reaches `opensAt`, the
 * countdown stops at zero and a "Try again" control appears; pressing it
 * dispatches `START`, which asks the server again. The server, holding the
 * time-lock secret, is the only authority on whether the letter opens.
 *
 * All strings come from copy.ts (R15.1). This component renders no sealed
 * payload field -- it has none.
 */

/** The parts of the time remaining the countdown line shows. */
type Remaining = { days: number; hours: number; minutes: number };

/**
 * Whole days, hours and minutes between `now` and `opensAt`, clamped at zero.
 * Pure: no clock access, so it is deterministic for a given pair of instants.
 */
function remainingFrom(opensAtMs: number, nowMs: number): Remaining {
  const ms = Math.max(0, opensAtMs - nowMs);
  const totalMinutes = Math.floor(ms / 60000);
  return {
    days: Math.floor(totalMinutes / (60 * 24)),
    hours: Math.floor((totalMinutes % (60 * 24)) / 60),
    minutes: totalMinutes % 60,
  };
}

/**
 * Whole seconds between `now` and `opensAt`, clamped at zero, rounded up so the
 * countdown never shows zero before the instant. Same rule as `remainingSeconds`
 * in `live/clock.ts` (display only).
 */
function remainingSecondsFrom(opensAtMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((opensAtMs - nowMs) / 1000));
}

/**
 * The precise countdown line for a live letter: minutes and seconds left. Pure,
 * so the formatting is testable without a clock.
 */
export function preciseRemainingText(opensAtMs: number, nowMs: number): string {
  const total = remainingSecondsFrom(opensAtMs, nowMs);
  return REVEAL_COPY.sealedRemainingSeconds
    .replace("{minutes}", String(Math.floor(total / 60)))
    .replace("{seconds}", String(total % 60));
}

export type StillSealedProps = {
  /** The UTC `Z` instant the letter opens. */
  opensAt: string;
  /** Dispatches `START` to retry once the countdown reaches zero. */
  onRetry: () => void;
  /**
   * Live letters only. Ticks every second and shows minutes and seconds, not
   * days and hours. Absent, the view is the persona countdown, unchanged.
   */
  precise?: boolean;
  /**
   * Called once when the countdown moves from above zero to zero while this
   * view is mounted. Not called when the view mounts already at zero. The
   * Letter_Page uses it for its single automatic re-check (R17.4).
   */
  onZero?: () => void;
};

export function StillSealed({
  opensAt,
  onRetry,
  precise = false,
  onZero,
}: StillSealedProps) {
  const opensAtMs = new Date(opensAt).getTime();
  const onZeroRef = useRef(onZero);
  useEffect(() => {
    onZeroRef.current = onZero;
  }, [onZero]);

  // Display-only countdown. Seeded to `opensAt` so the first server-rendered
  // frame shows a stable value, then ticked from the browser clock on the
  // client. The clock here only drives what the reader sees; it never gates
  // opening.
  const [nowMs, setNowMs] = useState(opensAtMs);

  useEffect(() => {
    // Whether the countdown was above zero when this view mounted. Only then
    // may `onZero` fire, and only once.
    const startedAbove = Date.now() < opensAtMs;
    let zeroSent = false;
    const tick = () => {
      const now = Date.now();
      setNowMs(now);
      if (precise && startedAbove && !zeroSent && now >= opensAtMs) {
        zeroSent = true;
        clearInterval(timer);
        onZeroRef.current?.();
      }
    };
    const timer = setInterval(tick, precise ? 1000 : 60000);
    tick();
    return () => clearInterval(timer);
  }, [opensAtMs, precise]);

  const remaining = remainingFrom(opensAtMs, nowMs);
  const atZero = nowMs >= opensAtMs;

  // A persona countdown shows the opening date in UTC; a live letter (precise)
  // shows it in the browser's own zone, the zone it was sealed in (R15.1).
  const zone: LetterZone = precise
    ? letterZoneFor("live", opensAt, browserTimeZone())
    : { kind: "utc" };
  const dateText = formatLetterDate(opensAt, zone);
  const bodyText = REVEAL_COPY.sealedBody.replace("{date}", dateText);
  const remainingText = precise
    ? preciseRemainingText(opensAtMs, nowMs)
    : REVEAL_COPY.sealedRemaining
        .replace("{days}", String(remaining.days))
        .replace("{hours}", String(remaining.hours))
        .replace("{minutes}", String(remaining.minutes));

  return (
    <section className={`${paper.paper} ${styles.sealed}`} data-paper="">
      <h1>{REVEAL_COPY.sealedTitle}</h1>
      <p>{bodyText}</p>
      {atZero ? (
        <button type="button" className={styles.button} onClick={onRetry}>
          {REVEAL_COPY.sealedRetry}
        </button>
      ) : (
        <p className={styles.remaining}>{remainingText}</p>
      )}
    </section>
  );
}
