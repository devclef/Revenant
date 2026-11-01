"use client";

import Link from "next/link";
import { ParchmentSurface } from "@/components/ui";
import { DEMO_COPY } from "@/components/demo/copy";
import { REVEAL_COPY } from "./copy";
import styles from "./reveal.module.css";

/**
 * The error view for every Opening_Flow failure state (design.md Error
 * Handling). It renders distinct copy per `kind` and, where the failure is
 * recoverable, a control to act on it. It renders NO sealed payload field: a
 * failed open carries no contents, and even a `tampered`/`verificationFailed`
 * open must show nothing from the letter (data-integrity.md: "Nothing from it
 * is shown").
 *
 * The eight kinds map one to one onto a copy string:
 *   notPlaced          -> the demo letter has not been placed yet (404).
 *   unreachable        -> network, 5xx or malformed response.
 *   verificationFailed -> the sealed hash did not match.
 *   wrongKey           -> the demo key did not open the letter.
 *   tampered           -> the decrypted contents did not match their seal.
 *   unsupportedFormat  -> a `format_version` this build can't read.
 *   invalidPayload     -> the letter opened but its contents are malformed.
 *   invalidInput       -> the letter's record is incomplete.
 *
 * Retry vs back:
 *   - `unreachable` is transient, so it offers "Try again" (dispatches `START`,
 *     which the reducer accepts in the `unreachable` state) alongside the link
 *     back to the demo letters.
 *   - every other kind is terminal: the only honest next step is to go back and
 *     choose another demo letter, so only the "back to the demo letters" link
 *     is shown. The copy for each already names that action (R15.4).
 *
 * Every string comes from copy.ts here or the demo copy module; no inline
 * literal lives in this component (R15.1).
 */

/** The error kinds this view can render, one per copy string. */
export type FlowErrorKind =
  | "notPlaced"
  | "unreachable"
  | "verificationFailed"
  | "wrongKey"
  | "tampered"
  | "unsupportedFormat"
  | "invalidPayload"
  | "invalidInput";

/** The message shown for each kind. */
const MESSAGE: Record<FlowErrorKind, string> = {
  notPlaced: REVEAL_COPY.notPlaced,
  unreachable: REVEAL_COPY.unreachable,
  verificationFailed: REVEAL_COPY.verificationFailed,
  wrongKey: REVEAL_COPY.wrongKey,
  tampered: REVEAL_COPY.tampered,
  unsupportedFormat: REVEAL_COPY.unsupportedFormat,
  invalidPayload: REVEAL_COPY.invalidPayload,
  invalidInput: REVEAL_COPY.invalidInput,
};

export type FlowErrorProps = {
  /** Which failure to render. */
  kind: FlowErrorKind;
  /**
   * Dispatches `START` to retry. Only read for the `unreachable` kind; the
   * retry control is not rendered for terminal kinds.
   */
  onRetry: () => void;
};

export function FlowError({ kind, onRetry }: FlowErrorProps) {
  const canRetry = kind === "unreachable";

  return (
    <ParchmentSurface as="section" className={styles.error}>
      <p>{MESSAGE[kind]}</p>
      {canRetry ? (
        <button type="button" className={styles.button} onClick={onRetry}>
          {REVEAL_COPY.retry}
        </button>
      ) : null}
      <p>
        <Link href="/demo">{DEMO_COPY.backToDemo}</Link>
      </p>
    </ParchmentSurface>
  );
}
