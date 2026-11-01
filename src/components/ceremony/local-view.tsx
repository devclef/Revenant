"use client";

// Feature: 05-reveal-ceremony
//
// The local-view context (design.md "The flow is the source of truth" and
// "Stage resolution"). A running Ceremony view holds only animation state —
// whether a Seal_Break is in progress, and the stage 3 Step — and reports it
// up to `CeremonyRoot` through this small context, so `data-ceremony` can name
// the exact Stage via `stageFor(state, localView)`.
//
// The context value is the current `LocalView` plus a setter. The setter merges
// a partial update into the current view, so a view touches only the field it
// owns (`SealBreak` sets `{ sealing }`; the stage 3 sequence sets `{ step }`),
// and the other field keeps its settled default.
//
// Final state first (design.md "Final state first", R17.3): the provider's
// initial value is always `DEFAULT_LOCAL_VIEW` ({ sealing: false, step:
// "done" }), so the server render and the FIRST client render report the
// settled state — `marks` for a static stage-1 reveal, `close` for a static
// stage-3 reveal — and hydration never mismatches. A view only ever moves the
// local view in an event handler or effect after mount, never during render.
//
// State is in-memory React context only (design.md "Data Models"): no storage,
// no network, no flow event. This module calls no `Math.random` and no
// `Date.now`, so the server and client render the same markup (Property 21),
// and it imports no `@/lib/crypto` — both enforced by the ceremony source scan.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { DEFAULT_LOCAL_VIEW, type LocalView } from "./stages";

/** The value exposed by `useLocalView()`. */
export type LocalViewContextValue = {
  /** The current view-local animation state. */
  localView: LocalView;
  /**
   * Merge a partial update into the current local view. A view sets only the
   * field it owns; the untouched field keeps its current (settled) value.
   */
  setLocalView: (patch: Partial<LocalView>) => void;
};

const LocalViewContext = createContext<LocalViewContextValue | null>(null);

/**
 * Provides the local-view context to the Ceremony tree. The initial value is
 * always `DEFAULT_LOCAL_VIEW`, so the server render and the first client render
 * report the settled state (R17.3). A nested provider defers to the parent, so
 * the desk and the ceremony always share one local view.
 */
export function LocalViewProvider({ children }: { children: ReactNode }) {
  const parent = useContext(LocalViewContext);
  const [localView, setView] = useState<LocalView>(DEFAULT_LOCAL_VIEW);

  const setLocalView = useCallback((patch: Partial<LocalView>) => {
    setView((current) => ({ ...current, ...patch }));
  }, []);

  const value = useMemo<LocalViewContextValue>(
    () => ({ localView, setLocalView }),
    [localView, setLocalView],
  );

  // A nested provider is a pass-through: the Ceremony has exactly one local
  // view, held by the outermost provider.
  if (parent !== null) {
    return <>{children}</>;
  }

  return (
    <LocalViewContext.Provider value={value}>
      {children}
    </LocalViewContext.Provider>
  );
}

/**
 * Read the local-view context. Throws when used outside a `LocalViewProvider`,
 * so a missing provider is a loud wiring bug rather than a silent wrong Stage.
 */
export function useLocalView(): LocalViewContextValue {
  const value = useContext(LocalViewContext);
  if (value === null) {
    throw new Error("useLocalView must be used within a LocalViewProvider");
  }
  return value;
}
