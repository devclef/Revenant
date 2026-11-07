"use client";

// Feature: 07-judge-journey
//
// The Top_Bar (design.md "Providers and the Top_Bar", R8.1 to R8.6). Fixed to
// the top of the window. It holds the wordmark and the Demo chip, and on the
// persona page the notice, Calm and Skip, in that order. Below 600 px the
// notice is not rendered here: PersonaIntro shows the same text as its first
// line at every width.
//
// Skip shows only while a sequence is registered (`useSequence().hasActive`),
// so it is in the Tab order only then. It is a native button, so Enter and
// Space work. Calm toggles `useMotion().setCalm`, as the region's control does.
//
// `data-wordmark` and `data-topbar-last` are set for the browser checks: the
// first marks the wordmark, the second the last control in the bar.

import Link from "next/link";
import { useEffect, useState } from "react";

import { CEREMONY_COPY } from "../copy";
import { PHONE_BELOW_PX } from "../constants";
import { useMotion } from "../motion";
import { useSequence } from "../skip";
import { SCENE_COPY } from "./copy";
import { MotionIcon, SkipIcon } from "./icons";
import styles from "./scene.module.css";

/**
 * The phone query. The largest width below PHONE_BELOW_PX, so `max-width`
 * excludes exactly 600 px. scene.module.css repeats the same 599.98px.
 */
export const PHONE_QUERY = `(max-width: ${PHONE_BELOW_PX - 0.02}px)`;

/**
 * True below PHONE_BELOW_PX, after the first client render (P5.1). The server
 * and the first client render report false, so hydration never mismatches.
 * The layout itself is CSS, so this only sets `data-compact` for the checks.
 */
function useCompact(): boolean {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const query = window.matchMedia(PHONE_QUERY);
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return compact;
}

/**
 * The controls at the end of the Top_Bar. `calm` shows Calm, and Skip while a
 * sequence is registered. `none` shows no controls, for a region that brings
 * its own Calm, Skip and sound (the Letter_Page).
 */
export type TopBarControls = "calm" | "none";

export type TopBarProps = {
  /**
   * The persona's name. When given, the Top_Bar shows the persona notice
   * (R8.4). On the landing page it is omitted, so no notice appears.
   */
  personaName?: string;
  /** Shows the Demo chip beside the wordmark. Default true. */
  demo?: boolean;
  /** Which controls the bar shows. Default `calm`. */
  controls?: TopBarControls;
};

/** The persona notice with the persona's name filled in. */
export function personaNoticeText(personaName: string): string {
  return SCENE_COPY.personaNotice.replace("{name}", personaName);
}

/**
 * Whether the Top_Bar renders the persona notice. It shows only for a persona
 * page and only at 600 px and wider (`compact` is false there). Below 600 px
 * PersonaIntro carries the notice instead.
 */
export function topBarShowsNotice(personaName: string | undefined, compact: boolean): boolean {
  return personaName !== undefined && !compact;
}

export function TopBar({
  personaName,
  demo = true,
  controls = "calm",
}: TopBarProps) {
  const { mode, setCalm } = useMotion();
  const { hasActive, skipAll } = useSequence();
  const compact = useCompact();

  const calmOn = mode === "calm";
  const calmLabel = calmOn ? CEREMONY_COPY.calmOff : CEREMONY_COPY.calmOn;

  // The last control in the bar: Skip when it shows, otherwise Calm.
  // Each control holds its icon and its text. Below 600 px CSS shows the icon
  // as a 44 x 44 control and hides the text; the aria-label and title keep the
  // name. At 600 px and wider CSS shows the text as before.
  return (
    <header
      className={styles.topbar}
      data-topbar
      data-compact={compact ? true : undefined}
    >
      <div className={styles.brand}>
        <p className={styles.wordmark}>
          <Link href="/" className={styles.wordmarkLink} data-wordmark>
            {SCENE_COPY.wordmark}
          </Link>
        </p>
        {demo ? (
          <span className={styles.chip}>{SCENE_COPY.demoChip}</span>
        ) : null}
      </div>
      {topBarShowsNotice(personaName, compact) && personaName !== undefined ? (
        <p className={styles.notice}>{personaNoticeText(personaName)}</p>
      ) : null}
      {controls === "none" ? null : (
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.control}
            data-topbar-last={hasActive ? undefined : true}
            aria-label={calmLabel}
            title={calmLabel}
            onClick={() => setCalm(!calmOn)}
          >
            <MotionIcon off={calmOn} className={styles.controlIcon} />
            <span className={styles.controlLabel}>{calmLabel}</span>
          </button>
          {hasActive ? (
            <button
              type="button"
              className={styles.control}
              data-topbar-last={true}
              aria-label={CEREMONY_COPY.skip}
              title={CEREMONY_COPY.skip}
              onClick={skipAll}
            >
              <SkipIcon className={styles.controlIcon} />
              <span className={styles.controlLabel}>{CEREMONY_COPY.skip}</span>
            </button>
          ) : null}
        </div>
      )}
    </header>
  );
}
