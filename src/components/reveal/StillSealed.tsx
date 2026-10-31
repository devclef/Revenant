"use client";

import { useEffect, useState } from "react";
import { ParchmentSurface } from "@/components/ui";
import { REVEAL_COPY } from "./copy";
import styles from "./reveal.module.css";

/**
 * The still-sealed view (R7.2). Shown when the letter exists but has not opened
 * yet: `GET /api/letters/{id}` returned `sealed`, or the secret route returned
 * 403. It reveals nothing about the contents -- only the opening date and the
 * time remaining, in Revenant's voice (tone.md: "an envelope on a mantelpiece").
 *
 * The opening instant (`opensAt`) is a UTC `Z` string from the server. The
 * displayed date is formatted in UTC so it reads the same for every viewer
 * (data-integrity.md: show the figure's own period, not the viewer's clock).
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

const UTC_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

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

export type StillSealedProps = {
  /** The UTC `Z` instant the letter opens. */
  opensAt: string;
  /** Dispatches `START` to retry once the countdown reaches zero. */
  onRetry: () => void;
};

export function StillSealed({ opensAt, onRetry }: StillSealedProps) {
  const opensAtMs = new Date(opensAt).getTime();

  // Display-only countdown. Seeded to `opensAt` so the first server-rendered
  // frame shows a stable value, then ticked from the browser clock on the
  // client. The clock here only drives what the reader sees; it never gates
  // opening.
  const [nowMs, setNowMs] = useState(opensAtMs);

  useEffect(() => {
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const remaining = remainingFrom(opensAtMs, nowMs);
  const atZero = nowMs >= opensAtMs;

  const dateText = UTC_DATE.format(new Date(opensAtMs));
  const bodyText = REVEAL_COPY.sealedBody.replace("{date}", dateText);
  const remainingText = REVEAL_COPY.sealedRemaining
    .replace("{days}", String(remaining.days))
    .replace("{hours}", String(remaining.hours))
    .replace("{minutes}", String(remaining.minutes));

  return (
    <ParchmentSurface as="section" className={styles.sealed}>
      <h1>{REVEAL_COPY.sealedTitle}</h1>
      <p>{bodyText}</p>
      {atZero ? (
        <button type="button" className={styles.button} onClick={onRetry}>
          {REVEAL_COPY.sealedRetry}
        </button>
      ) : (
        <p className={styles.remaining}>{remainingText}</p>
      )}
    </ParchmentSurface>
  );
}
