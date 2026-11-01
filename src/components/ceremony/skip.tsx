"use client";

/**
 * Feature: 05-reveal-ceremony
 *
 * The Skip context (design.md "File layout" row `skip.tsx`, and the task:
 * "Export a SkipProvider and useSequence() that lets a running sequence
 * register/unregister itself, and exposes whether any sequence is registered
 * plus a skipAll() that ends all").
 *
 * A "sequence" is any running Ceremony animation (the Seal_Break, the ink
 * reveal, the then/now Steps). While at least one sequence is registered,
 * `CeremonyRoot` shows the Skip control (Property 19); pressing it calls every
 * registered sequence's `skip` callback, which jumps that sequence to its final
 * settled state. A sequence unregisters itself when it finishes or unmounts.
 *
 * No sequence registers itself in this task; the API only has to exist so a
 * later task's sequence can plug in, and so `CeremonyRoot` can decide whether
 * to show Skip from `useSequence().hasActive`.
 *
 * State is in-memory React context only (design.md "Data Models"): there is no
 * storage, no network and no flow event. Skipping is purely a view concern and
 * sends no flow event (R11.4, R12.7).
 *
 * This module imports no `@/lib/crypto`. It uses no `Math.random` or
 * `Date.now`, so the server and client render the same markup (Property 21).
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * What a registered sequence hands the context: a callback that moves it to its
 * final settled state. It is called at most once per skip; a sequence that has
 * already finished should have unregistered itself first.
 */
export type SequenceSkip = () => void;

/** The value exposed by `useSequence()`. */
export type SkipContextValue = {
  /** True when at least one sequence is currently registered. */
  hasActive: boolean;
  /**
   * Register a running sequence's skip callback. Returns an `unregister`
   * function; call it when the sequence finishes or unmounts. Each call
   * registers a distinct entry, so a component can register and unregister
   * safely across its lifetime.
   */
  register: (skip: SequenceSkip) => () => void;
  /**
   * End every registered sequence by calling each one's skip callback. Safe to
   * call with nothing registered (it is then a no-op). Registered sequences are
   * expected to unregister themselves as they settle.
   */
  skipAll: () => void;
};

const SkipContext = createContext<SkipContextValue | null>(null);

/**
 * Provides the Skip context to the Ceremony tree. Holds the set of registered
 * sequence skip callbacks in a ref (so registering never re-renders a running
 * sequence) and exposes only a count in React state (so `hasActive` and the
 * Skip control update when the set changes).
 */
export function SkipProvider({ children }: { children: ReactNode }) {
  // The registered skip callbacks, keyed by a monotonic id. Kept in a ref so
  // that registering or unregistering a sequence does not itself trigger a
  // re-render of the sequence that registered. The derived `count` drives the
  // one piece of state the UI needs.
  const sequences = useRef(new Map<number, SequenceSkip>());
  const nextId = useRef(0);
  const [count, setCount] = useState(0);

  const register = useCallback((skip: SequenceSkip) => {
    const id = nextId.current++;
    sequences.current.set(id, skip);
    setCount(sequences.current.size);

    let registered = true;
    return () => {
      // Idempotent: a double unregister (finish then unmount) is harmless.
      if (!registered) return;
      registered = false;
      sequences.current.delete(id);
      setCount(sequences.current.size);
    };
  }, []);

  const skipAll = useCallback(() => {
    // Snapshot before iterating: a skip callback may unregister its own
    // sequence (and so mutate the map) as it settles.
    const skips = Array.from(sequences.current.values());
    for (const skip of skips) {
      skip();
    }
  }, []);

  const value = useMemo<SkipContextValue>(
    () => ({ hasActive: count > 0, register, skipAll }),
    [count, register, skipAll],
  );

  return <SkipContext.Provider value={value}>{children}</SkipContext.Provider>;
}

/**
 * Read the Skip context. Throws when used outside a `SkipProvider`, so a
 * missing provider is a loud wiring bug rather than a silent no-op.
 */
export function useSequence(): SkipContextValue {
  const value = useContext(SkipContext);
  if (value === null) {
    throw new Error("useSequence must be used within a SkipProvider");
  }
  return value;
}
