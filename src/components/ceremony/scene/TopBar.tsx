"use client";

// Feature: 07-judge-journey
//
// The Top_Bar (design.md "Providers and the Top_Bar", R8.1 to R8.6). Fixed to
// the top of the window. It holds the wordmark and the Demo chip, and on the
// persona page the notice, Calm and Skip, in that order.
//
// Skip shows only while a sequence is registered (`useSequence().hasActive`),
// so it is in the Tab order only then. It is a native button, so Enter and
// Space work. Calm toggles `useMotion().setCalm`, as the region's control does.
//
// `data-wordmark` and `data-topbar-last` are set for the browser checks: the
// first marks the wordmark, the second the last control in the bar.

import Link from "next/link";

import { CEREMONY_COPY } from "../copy";
import { useMotion } from "../motion";
import { useSequence } from "../skip";
import { SCENE_COPY } from "./copy";
import styles from "./scene.module.css";

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

export function TopBar({
  personaName,
  demo = true,
  controls = "calm",
}: TopBarProps) {
  const { mode, setCalm } = useMotion();
  const { hasActive, skipAll } = useSequence();

  const calmOn = mode === "calm";
  const calmLabel = calmOn ? CEREMONY_COPY.calmOff : CEREMONY_COPY.calmOn;

  // The last control in the bar: Skip when it shows, otherwise Calm.
  return (
    <header className={styles.topbar} data-topbar>
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
      {personaName === undefined ? null : (
        <p className={styles.notice}>{personaNoticeText(personaName)}</p>
      )}
      {controls === "none" ? null : (
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.control}
            data-topbar-last={hasActive ? undefined : true}
            onClick={() => setCalm(!calmOn)}
          >
            {calmLabel}
          </button>
          {hasActive ? (
            <button
              type="button"
              className={styles.control}
              data-topbar-last={true}
              onClick={skipAll}
            >
              {CEREMONY_COPY.skip}
            </button>
          ) : null}
        </div>
      )}
    </header>
  );
}
