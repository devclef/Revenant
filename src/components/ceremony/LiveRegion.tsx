"use client";

/**
 * Feature: 05-reveal-ceremony
 *
 * One polite live region per Ceremony page (design.md "File layout" row
 * `LiveRegion.tsx`, and the task: "one polite live region per page
 * (aria-live='polite', visually-hidden) that announces a message prop").
 *
 * Why a live region: the Ceremony tells its story through motion, and a
 * reader who cannot see that motion (a screen-reader reader, or anyone in
 * Calm_Mode / prefers-reduced-motion) must still be told where the Ceremony
 * is. `CeremonyRoot` pushes one short line per Stage from
 * `CEREMONY_COPY.stageLive` into this region, and the reader hears it
 * announced politely without any content jumping into view (R3.1).
 *
 * The markup carries no inline literal text (R15.1): the announced line comes
 * in entirely as the `message` prop, so no copy lives in this component. The
 * region is visually hidden (its `.liveRegion` class in `ceremony.module.css`),
 * so it is heard but never seen; up, down, then and now are all announced the
 * same way, with no colour or judgement (neutrality.md, R10.1).
 *
 * This module imports no `@/lib/crypto` and uses no `Math.random` or
 * `Date.now`, so the server and client render the same markup (Property 21).
 *
 * Two shapes are exported:
 *   - `<LiveRegion message={...} />` — the region itself, which announces
 *     whatever `message` it is given.
 *   - a small context (`LiveRegionProvider` + `useLiveRegion`) so a component
 *     deeper in the tree — `CeremonyRoot` — can push the per-Stage line
 *     without threading it through props. The provider renders the region for
 *     you from the pushed message.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import styles from "./ceremony.module.css";

/**
 * The polite live region. It announces `message` and nothing else; an empty
 * message announces nothing. The region is always present in the DOM (so a
 * screen reader is already watching it) and only its text content changes,
 * which is what makes `aria-live="polite"` announce the update.
 */
export function LiveRegion({ message }: { message: string }) {
  return (
    <div
      className={styles.liveRegion}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {message}
    </div>
  );
}

/** What `useLiveRegion()` exposes: push a line to announce. */
export type LiveRegionContextValue = {
  /**
   * Replace the announced line. Passing the same line again is a no-op (so a
   * re-render that does not change the Stage announces nothing twice).
   */
  announce: (message: string) => void;
};

const LiveRegionContext = createContext<LiveRegionContextValue | null>(null);

/**
 * Provides the live region to the Ceremony tree and renders the single
 * `<LiveRegion>` for it. A descendant pushes the current Stage line with
 * `useLiveRegion().announce(...)`; the provider holds that line in state and
 * feeds it to the region, so there is exactly one polite region per page.
 */
export function LiveRegionProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");

  const announce = useCallback((next: string) => {
    // Only update when the line actually changes, so an unrelated re-render
    // does not re-announce the same Stage.
    setMessage((current) => (current === next ? current : next));
  }, []);

  const value = useMemo<LiveRegionContextValue>(() => ({ announce }), [
    announce,
  ]);

  return (
    <LiveRegionContext.Provider value={value}>
      {children}
      <LiveRegion message={message} />
    </LiveRegionContext.Provider>
  );
}

/**
 * Read the live-region context. Throws when used outside a
 * `LiveRegionProvider`, so a missing provider is a loud wiring bug rather than
 * a silently dropped announcement.
 */
export function useLiveRegion(): LiveRegionContextValue {
  const value = useContext(LiveRegionContext);
  if (value === null) {
    throw new Error("useLiveRegion must be used within a LiveRegionProvider");
  }
  return value;
}
