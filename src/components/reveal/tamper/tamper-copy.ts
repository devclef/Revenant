// Copy for the Tamper_Control result (spec 13, A2 and A4). Browser-only.
//
// Every string the tamper result shows lives here, so the tone and neutrality
// rules can be checked in one file. The vocabulary follows `tone.md`: seal,
// cracked, copy, record. The copy never says caught, wrong, hacked, attack,
// failed to break, congratulations or any score, and it never grades the judge.

import type {
  RecomputedFingerprintRun,
  TamperChange,
  TamperRun,
} from "./tamper-run";

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

  /** The second-layer control, shown under a cracked seal (spec 13, A3.2). */
  secondLayerButton: "Also fix the fingerprint",

  /** The line beside the second-layer control. */
  secondLayerNote:
    "This recomputes the copy's fingerprint and tries the copy again. The stored letter is not changed.",

  /** The heading over the two attempts and the check that refused each one. */
  attemptsHeading: "Where each attempt stopped",

  /** Labels for the two attempts. */
  attemptOne: "The one-byte change",
  attemptTwo: "The one-byte change, with its fingerprint fixed",

  /** The refusal lines. Each names the check, not a verdict on the judge. */
  refusedAtFingerprint:
    "Refused at the fingerprint check. The copy's fingerprint does not match the stored one.",
  refusedAtTag:
    "Refused at the authentication tag check. The fingerprint matches, and the encrypted text does not.",
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

/** The two checks that can refuse a copy, in the order `openLetter` runs them. */
export type RefusalLayer = "fingerprint" | "tag";

/**
 * The check that refused a copy, from the `openLetter` error kind. `null` for
 * any other error kind, so a setup failure is never reported as a refusal.
 */
export function refusalLayer(kind: string): RefusalLayer | null {
  if (kind === "verification_failed") return "fingerprint";
  if (kind === "tampered") return "tag";
  return null;
}

/** The plain line that names the check which refused an attempt. */
export function refusalLine(layer: RefusalLayer): string {
  return layer === "fingerprint"
    ? TAMPER_COPY.refusedAtFingerprint
    : TAMPER_COPY.refusedAtTag;
}

/** One attempt and the check that refused it. */
export interface AttemptLine {
  readonly label: string;
  readonly refusal: string;
}

/** The second-layer result the component shows. */
export type SecondLayerCopy =
  | {
      readonly kind: "attempts";
      readonly heading: string;
      readonly attempts: readonly [AttemptLine, AttemptLine];
    }
  | {
      readonly kind: "not_as_expected";
      readonly message: string;
    };

/**
 * Map the first refusal and the second-layer run to the two-line summary. The
 * summary appears only when the first attempt was refused at the fingerprint
 * check and the fingerprint-fixed copy was refused at the tag check. Any other
 * outcome gets the plain not-as-expected message.
 */
export function secondLayerCopy(
  first: RefusalLayer | null,
  run: Pick<RecomputedFingerprintRun, "result">,
): SecondLayerCopy {
  const notAsExpected: SecondLayerCopy = {
    kind: "not_as_expected",
    message: TAMPER_COPY.notAsExpected,
  };
  if (first !== "fingerprint") return notAsExpected;
  const result = run.result;
  if (result.ok) return notAsExpected;
  if (refusalLayer(result.error.kind) !== "tag") return notAsExpected;
  return {
    kind: "attempts",
    heading: TAMPER_COPY.attemptsHeading,
    attempts: [
      { label: TAMPER_COPY.attemptOne, refusal: refusalLine("fingerprint") },
      { label: TAMPER_COPY.attemptTwo, refusal: refusalLine("tag") },
    ],
  };
}

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
  if (refusalLayer(run.result.error.kind) === null) {
    return { kind: "not_as_expected", message: TAMPER_COPY.notAsExpected };
  }
  return {
    kind: "cracked",
    heading: TAMPER_COPY.cracked,
    change: changeLine(run.change),
    reliefNotProof: TAMPER_COPY.reliefNotProof,
  };
}
