"use client";

// Feature: 07-judge-journey
//
// The Top_Bar (design.md "Providers and the Top_Bar", R8.1 to R8.6). Fixed to the
// top of the window. Spec 15 Requirement 5.1 sets its slots on every page: the
// wordmark (capitals by CSS) and the Demo chip on the left; on the right, the
// persona notice (persona pages only), Calm, Sound (only where there is sound)
// and Skip (only while a sequence runs).
//
// The Skip slot is reserved and first in the button group, so the other
// controls keep their place. While no sequence runs, a non-interactive
// placeholder holds that slot (aria-hidden, no focus). While a sequence runs,
// Skip is a live button in the same place. A disabled control is never shown.
//
// `data-topbar-slot` marks each slot for the browser checks, and
// `data-topbar-last` marks the rightmost control of the bar (Sound when shown,
// otherwise Calm).
//
// Calm toggles `useMotion().setCalm`, as the region's control does.
// On the persona page the bar also holds the sound toggle (spec 09 C4.4).
// SceneShell owns its state and passes it in as `sound`.

import Link from "next/link";
import { useEffect, useRef, useState, type RefObject } from "react";

import { CEREMONY_COPY } from "../copy";
import { PHONE_BELOW_PX } from "../constants";
import { useMotion } from "../motion";
import { useSequence } from "../skip";
import { SoundToggle } from "../sound/SoundToggle";
import { type Stage } from "../stages";
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
 * sequence is registered. `none` shows neither, for a region that brings its
 * own Calm and Skip (the Letter_Page). The sound control still shows when the
 * page passes sound state.
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
  /**
   * The sound toggle, between Calm and Skip (spec 09 C4.4). Its state lives
   * in SceneShell, because the Seal_Break reads it. Omit it on a page with
   * no sound cue, so the bar shows no sound control there.
   */
  sound?: TopBarSound;
  /**
   * The current Stage of the persona page, reported up from the Ceremony.
   * Kept for the callers. It no longer changes the notice: the notice shows
   * for every Stage and width (spec 14 B1.4).
   */
  stage?: Stage;
};

/** The sound state the Top_Bar toggle shows, and the press that changes it. */
export type TopBarSound = {
  enabled: boolean;
  onChange: (next: boolean) => void;
  /** Holds the slot, hidden, until the page's sound is ready (SoundSlotContext). */
  reserved?: boolean;
};

/** The persona notice with the persona's name filled in. */
export function personaNoticeText(personaName: string): string {
  return CEREMONY_COPY.personaNotice.replace("{name}", personaName);
}

/**
 * Whether the Top_Bar renders the persona notice. It shows on every persona
 * page, for every Stage and at every width (spec 14 B1.4). It needs a persona
 * name; a page without one shows no notice.
 */
export function topBarShowsNotice(personaName: string | undefined): boolean {
  return personaName !== undefined;
}

/**
 * Publishes the Top_Bar's rendered height as `--topbar-clear` on the document
 * root, so a heading's scroll-margin-top clears the fixed bar even when the
 * bar wraps taller than 96 px (a phone with the persona notice). The value
 * follows the bar through a ResizeObserver and is removed on unmount.
 */
function useTopBarClear(headerRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const header = headerRef.current;
    if (!header || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    const update = () => {
      root.style.setProperty("--topbar-clear", `${header.offsetHeight}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--topbar-clear");
    };
  }, [headerRef]);
}

export function TopBar({
  personaName,
  demo = true,
  controls = "calm",
  sound,
}: TopBarProps) {
  const { mode, setCalm } = useMotion();
  const { hasActive, skipAll } = useSequence();
  const compact = useCompact();
  const headerRef = useRef<HTMLElement>(null);
  useTopBarClear(headerRef);

  const calmOn = mode === "calm";
  const calmLabel = calmOn ? CEREMONY_COPY.calmOff : CEREMONY_COPY.calmOn;

  // Each control holds its icon and its text. Below 600 px CSS shows the icon
  // as a 44 x 44 control and hides the text; the aria-label and title keep the
  // name. At 600 px and wider CSS shows the text as before.
  //
  // Slot order (spec 15 Requirement 5.1): wordmark, Demo chip, persona notice,
  // then the button group. The group starts with the reserved Skip slot, so
  // Calm and Sound keep their place when Skip appears.
  return (
    <header
      ref={headerRef}
      className={styles.topbar}
      data-topbar
      data-compact={compact ? true : undefined}
    >
      <div className={styles.brand}>
        <p className={styles.wordmark} data-topbar-slot="wordmark">
          <Link href="/" className={styles.wordmarkLink} data-wordmark>
            {SCENE_COPY.wordmark}
          </Link>
        </p>
        {demo ? (
          <span className={styles.chip} data-topbar-slot="chip">
            {SCENE_COPY.demoChip}
          </span>
        ) : null}
      </div>
      {topBarShowsNotice(personaName) && personaName !== undefined ? (
        <p className={styles.notice} data-topbar-slot="notice">
          {personaNoticeText(personaName)}
        </p>
      ) : null}
      {controls === "none" && sound === undefined ? null : (
        <div className={styles.controls}>
          {controls === "none" ? null : (
            <>
              {hasActive ? (
                <button
                  type="button"
                  className={styles.control}
                  data-topbar-slot="skip"
                  aria-label={CEREMONY_COPY.skip}
                  title={CEREMONY_COPY.skip}
                  onClick={skipAll}
                >
                  <SkipIcon className={styles.controlIcon} />
                  <span className={styles.controlLabel}>{CEREMONY_COPY.skip}</span>
                </button>
              ) : (
                <span
                  className={styles.skipReserve}
                  data-topbar-reserve=""
                  aria-hidden="true"
                />
              )}
              <button
                type="button"
                className={styles.control}
                data-topbar-slot="calm"
                data-topbar-last={sound === undefined ? true : undefined}
                aria-label={calmLabel}
                title={calmLabel}
                onClick={() => setCalm(!calmOn)}
              >
                <MotionIcon off={calmOn} className={styles.controlIcon} />
                <span className={styles.controlLabel}>{calmLabel}</span>
              </button>
            </>
          )}
          {sound !== undefined ? (
            <SoundToggle
              variant="topbar"
              enabled={sound.enabled}
              onChange={sound.onChange}
              reserved={sound.reserved}
              last
            />
          ) : null}
        </div>
      )}
    </header>
  );
}
