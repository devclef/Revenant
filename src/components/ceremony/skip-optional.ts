// Feature: 07-judge-journey (task 5)
//
// The Skip context for components that also render on their own, outside a
// SkipProvider: the Ghost and the letter in static renders and unit tests.
// `useSequence` throws without a provider. This wrapper returns null instead, so
// Skip is simply not offered there. It calls `useSequence` in the same position
// on every render, so hook order is unchanged.
//
// Kept out of `skip.tsx` so that tests which mock `./skip` with `useSequence`
// alone keep working.

import { useSequence, type SkipContextValue } from "./skip";

/** The registered Skip context, or null when no SkipProvider wraps the caller. */
export function useMaybeSequence(): SkipContextValue | null {
  try {
    return useSequence();
  } catch {
    return null;
  }
}
