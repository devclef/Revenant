/**
 * Browser client for GET /api/figures (issue #202). The Reveal and the Seal_Page
 * read the "now" figures from this one response, so both screens see the same
 * catalogue.
 *
 * `loadFigures` makes exactly one request, aborts it after 30 seconds and maps
 * every failure to `failed`: a thrown fetch, a non-2xx status, a body that is
 * not JSON, and a body that `parseFiguresResponse` rejects.
 *
 * `useFigures` calls `loadFigures` once per mounted reveal. A ref guards the
 * request so React's development double-mount does not send a second one. The
 * request is not aborted on unmount, so a late answer only updates state that
 * no longer renders. That costs at most 30 seconds of a pending request.
 *
 * Requests use the same options as the letter routes in `./api.ts`: no cache,
 * same-origin credentials and no referrer. Nothing is logged and nothing is
 * stored.
 */

import { useEffect, useRef, useState } from "react";

import {
  figuresStateFrom,
  FIGURES_TIMEOUT_MS,
  type FiguresState,
} from "@/components/live/figures-state";

export { FIGURES_TIMEOUT_MS, type FiguresState };

/** The fixed relative route. No origin, no query. */
export const FIGURES_URL = "/api/figures";

/** The request options every figures call shares. */
const FIGURES_INIT = {
  cache: "no-store",
  credentials: "same-origin",
  referrerPolicy: "no-referrer",
} as const satisfies RequestInit;

/**
 * Sends one `GET /api/figures` and resolves with its outcome. It never rejects.
 * `fetchImpl` is injectable for tests and defaults to the global `fetch`.
 */
export async function loadFigures(
  fetchImpl: typeof fetch = fetch,
): Promise<FiguresState> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FIGURES_TIMEOUT_MS);
  try {
    const response = await fetchImpl(FIGURES_URL, {
      ...FIGURES_INIT,
      signal: controller.signal,
    });
    // A body that is not JSON throws here and is mapped to `rejected` below.
    const body = response.status === 200 ? await response.json() : undefined;
    return figuresStateFrom({
      kind: "response",
      status: response.status,
      body,
    });
  } catch {
    return figuresStateFrom({
      kind: controller.signal.aborted ? "aborted" : "rejected",
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Loads the figures once per mounted reveal and returns their state. It starts
 * as `loading`, then becomes `ready` or `failed`.
 */
export function useFigures(fetchImpl?: typeof fetch): FiguresState {
  const [state, setState] = useState<FiguresState>({ status: "loading" });
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    void loadFigures(fetchImpl).then(setState);
  }, []);

  return state;
}
