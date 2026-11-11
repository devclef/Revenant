/**
 * The line shown with a Now_Figure's place in a reveal entry (issue #250, A3).
 *
 * `nowMessageFor` maps the outcome of one "now" lookup to its copy. It is the
 * only place that chooses between the "no longer published", "not fetched yet",
 * "no newer figure reached" and "fallback" lines, so each message describes the real
 * reason and nothing else.
 *
 * - `series_missing` (the series is not in the figures response) gives
 *   `nowRetired`, the only line that says "no longer published".
 * - `no_figure` (the series is listed but has no figure) gives `nowNotYet`.
 * - A failed request gives `nowRequestFailed`, which says only that no newer
 *   figure was reached.
 * - A found figure that came from the bundled fallback file gives `fallbackNote`
 *   with its retrieved date. A stored figure gives no line.
 * - A request still in flight is not a reason in this module; the caller shows
 *   `nowLoading` itself.
 *
 * Pure: no clock, no network, no state. Imports only copy.ts and the UTC date
 * formatter, so it is safe in the browser and in tests.
 */

import { formatLetterDate } from "@/components/ui/letter-date";

import { REVEAL_COPY } from "./copy";

/** The outcome of one now lookup that needs a message. */
export type NowMessageReason =
  | { readonly kind: "series_missing" }
  | { readonly kind: "no_figure" }
  | { readonly kind: "request_failed" }
  | {
      readonly kind: "found";
      /** True when the figure came from the bundled fallback file. */
      readonly fallback: boolean;
      /** The figure's `retrieved_at`, a UTC instant. */
      readonly retrievedAt: string;
    };

/**
 * The copy for one now lookup. Returns `null` when the reason needs no line: a
 * found stored figure, which is shown with its own period and source only.
 */
export function nowMessageFor(reason: NowMessageReason): string | null {
  switch (reason.kind) {
    case "series_missing":
      return REVEAL_COPY.nowRetired;
    case "no_figure":
      return REVEAL_COPY.nowNotYet;
    case "request_failed":
      return REVEAL_COPY.nowRequestFailed;
    case "found":
      if (!reason.fallback) return null;
      return REVEAL_COPY.fallbackNote.replace(
        "{date}",
        formatLetterDate(reason.retrievedAt, { kind: "utc" }),
      );
  }
}
