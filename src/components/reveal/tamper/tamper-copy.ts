// Copy for the Tamper_Control result (spec 13, A2 and A4). Browser-only.
//
// Every string the tamper result shows lives here, so the tone and neutrality
// rules can be checked in one file. The vocabulary follows `tone.md`: seal,
// cracked, copy, record. The copy never says caught, wrong, hacked, attack,
// failed to break, congratulations or any score, and it never grades the judge.

import type { TamperChange, TamperRun } from "./tamper-run";

export const TAMPER_COPY = {
  /** The button that starts the run. Keyboard reachable. */
  button: "Try to tamper with it",

  /** The line beside the button, and again under the result (A4.1). */
  note: "This runs on a copy in your browser. The stored letter is not changed.",

  /** The result for a copy that openLetter refused (A2.4). */
  cracked: "The seal is cracked. Revenant refuses to open this copy.",

  /** The result when the run did not behave as the design expects (A2.5). */
  notAsExpected:
    "The test did not run as expected. Nothing here changed the stored letter.",

  /** The one sentence about what the seal does not prove. Shown once per result (U6). */
  reliefNotProof:
    "The seal's shape is drawn from the letter's fingerprint, so it is a picture of that fingerprint and does not prove the letter.",

  /** Labels for the two seals and the two Fingerprints. */
  storedLetter: "The stored letter",
  storedFingerprint: "Stored fingerprint",
  copyFingerprint: "Fingerprint of the copy",

  /** The control that clears the result. */
  close: "Close",
} as const;

/** A byte value as a two-digit hex string, for example `0x3a`. */
export function formatByte(value: number): string {
  return `0x${value.toString(16).padStart(2, "0")}`;
}

/** The byte line under the cracked seal: index, total, and the value before and after. */
export function changeLine(change: TamperChange): string {
  return `Byte ${change.byteIndex} of ${change.total} changed from ${formatByte(
    change.before,
  )} to ${formatByte(change.after)}.`;
}

/** The result the component shows, built only from a `TamperRun`. */
export type TamperResultCopy =
  | {
      readonly kind: "cracked";
      readonly heading: string;
      readonly change: string;
      readonly reliefNotProof: string;
    }
  | {
      readonly kind: "not_as_expected";
      readonly message: string;
    };

/** Error kinds `openLetter` returns for a copy it refuses. */
const REFUSAL_KINDS: ReadonlySet<string> = new Set<string>([
  "verification_failed",
  "tampered",
]);

/**
 * Map a tamper run to the copy the judge sees. The cracked seal appears only
 * when `openLetter` itself refused the copy. An untouched copy that did not
 * open, or a copy that opened, gets the plain not-as-expected message.
 */
export function tamperResultCopy(run: TamperRun): TamperResultCopy {
  if (!run.untampered.ok) {
    return { kind: "not_as_expected", message: TAMPER_COPY.notAsExpected };
  }
  if (run.result.ok) {
    return { kind: "not_as_expected", message: TAMPER_COPY.notAsExpected };
  }
  if (!REFUSAL_KINDS.has(run.result.error.kind)) {
    return { kind: "not_as_expected", message: TAMPER_COPY.notAsExpected };
  }
  return {
    kind: "cracked",
    heading: TAMPER_COPY.cracked,
    change: changeLine(run.change),
    reliefNotProof: TAMPER_COPY.reliefNotProof,
  };
}
