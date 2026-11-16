"use client";

// Tamper_Control (spec 13, A1 to A4). A native button on the persona Read step,
// beside the seal verdict. Pressing it runs `runTamper` on a copy of the stored
// envelope in the browser and shows the result. It makes no request, calls no
// API route and writes nothing to storage, cookies or the URL.
//
// The verdict comes only from the `TamperRun` that `runTamper` returns, through
// `tamperResultCopy`. This file holds no check of its own. Closing the result
// clears this component's own view; the Opening_Flow state is untouched, so the
// reader continues with the real letter.

import { useRef, useState } from "react";
import { WaxSeal } from "@/components/ui/WaxSeal";
import { useCalmInForce } from "@/components/ceremony/motion";
import {
  CRACK_PATHS,
  TOTAL_LENGTH,
} from "@/components/ceremony/seal/cracks";
import { formatFingerprint } from "@/lib/seal-format";
import type { TamperRun, TamperSource } from "./tamper-run";
import {
  TAMPER_COPY,
  refusalLayer,
  secondLayerCopy,
  tamperResultCopy,
  type RefusalLayer,
  type SecondLayerCopy,
  type TamperResultCopy,
} from "./tamper-copy";
import styles from "./tamper.module.css";

/** Seal size in CSS px. Matches the persona seals (spec 13, U9). */
const SEAL_SIZE = 96;

type View =
  | { readonly kind: "idle" }
  | { readonly kind: "busy" }
  | {
      readonly kind: "result";
      readonly copy: TamperResultCopy;
      /** Both hashes, when the run produced them. Absent for a failed setup. */
      readonly hashes: {
        readonly stored: string;
        readonly copy: string;
      } | null;
      /** The check that refused the one-byte copy. Null when there was no refusal. */
      readonly layer: RefusalLayer | null;
    };

/** The second-layer control's own view. Cleared when the result closes. */
type SecondView =
  | { readonly kind: "idle" }
  | { readonly kind: "busy" }
  | { readonly kind: "done"; readonly copy: SecondLayerCopy };

export type TamperControlProps = {
  /**
   * Returns the stored envelope and secret, or null before the letter has
   * opened. OpeningFlow passes `flow.tamperSource`, which is set only for a
   * demo letter whose `openLetter` has passed.
   */
  getSource: () => TamperSource | null;
};

/** The 16 groups of a hash as text, or an empty string for a malformed hash. */
function fingerprintText(hash: string): string {
  return formatFingerprint(hash) ?? "";
}

/**
 * The cracked copy's seal. Drawn from the same nine crack paths as the break
 * overlay. Fully drawn at once: the draw-in animation is CSS only and is turned
 * off under reduced motion and Calm.
 */
function CrackOverlay({ drawing }: { readonly drawing: boolean }) {
  return (
    <svg
      className={`${styles.crack}${drawing ? ` ${styles.drawing}` : ""}`}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      {CRACK_PATHS.map((d) => (
        <path
          key={d}
          d={d}
          pathLength={TOTAL_LENGTH}
          strokeDasharray={TOTAL_LENGTH}
          strokeDashoffset={0}
        />
      ))}
    </svg>
  );
}

/**
 * The second-layer summary: one line per attempt, with the check that refused
 * it. Exported so the markup can be tested without a press.
 */
export function SecondLayerResult({
  copy,
}: {
  readonly copy: SecondLayerCopy;
}) {
  if (copy.kind === "not_as_expected") {
    return (
      <p className={styles.message} data-tamper-second="">
        {copy.message}
      </p>
    );
  }
  return (
    <div className={styles.attemptsBlock} data-tamper-second="">
      <p className={styles.heading}>{copy.heading}</p>
      <ol className={styles.attempts}>
        {copy.attempts.map((attempt) => (
          <li key={attempt.label} className={styles.attempt}>
            <span className={styles.attemptLabel}>{attempt.label}</span>
            <p className={styles.attemptRefusal}>{attempt.refusal}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function TamperControl({ getSource }: TamperControlProps) {
  const [view, setView] = useState<View>({ kind: "idle" });
  const [second, setSecond] = useState<SecondView>({ kind: "idle" });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const calm = useCalmInForce();

  // Runs the real check. `runTamper` is loaded on the first press only, so the
  // tamper module stays out of the first-load JavaScript of the persona page.
  async function press() {
    const source = getSource();
    setView({ kind: "busy" });
    setSecond({ kind: "idle" });
    if (source === null) {
      setView({
        kind: "result",
        copy: { kind: "not_as_expected", message: TAMPER_COPY.notAsExpected },
        hashes: null,
        layer: null,
      });
      return;
    }
    try {
      const { runTamper } = await import("./tamper-run");
      const run: TamperRun = await runTamper(source);
      setView({
        kind: "result",
        copy: tamperResultCopy(run),
        hashes: { stored: source.envelopeHash, copy: run.copyHash },
        layer: run.result.ok ? null : refusalLayer(run.result.error.kind),
      });
    } catch {
      // A thrown run is a broken setup. It is shown as the plain message, never
      // as a cracked seal.
      setView({
        kind: "result",
        copy: { kind: "not_as_expected", message: TAMPER_COPY.notAsExpected },
        hashes: null,
        layer: null,
      });
    }
  }

  // Runs the second layer on the same stored letter: the copy's fingerprint is
  // recomputed, so the refusal that remains is the tag check. Offered only
  // under a cracked seal, and `first` is the layer that refused the one-byte copy.
  async function pressSecond(first: RefusalLayer) {
    const source = getSource();
    setSecond({ kind: "busy" });
    if (source === null) {
      setSecond({
        kind: "done",
        copy: { kind: "not_as_expected", message: TAMPER_COPY.notAsExpected },
      });
      return;
    }
    try {
      const { runRecomputedFingerprint } = await import("./tamper-run");
      const run = await runRecomputedFingerprint(source);
      setSecond({ kind: "done", copy: secondLayerCopy(first, run) });
    } catch {
      setSecond({
        kind: "done",
        copy: { kind: "not_as_expected", message: TAMPER_COPY.notAsExpected },
      });
    }
  }

  // Closing clears this control's view and returns focus to the control.
  function close() {
    setView({ kind: "idle" });
    setSecond({ kind: "idle" });
    buttonRef.current?.focus();
  }

  const busy = view.kind === "busy";
  const first = view.kind === "result" ? view.layer : null;

  return (
    <section className={styles.tamper} data-tamper="" aria-busy={busy}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.button}
        aria-busy={busy}
        aria-describedby="tamper-note"
        onClick={() => void press()}
      >
        {TAMPER_COPY.button}
      </button>
      <p id="tamper-note" className={styles.note}>
        {TAMPER_COPY.note}
      </p>

      {view.kind === "result" ? (
        <div className={styles.result} role="status" data-tamper-result="">
          {view.copy.kind === "cracked" && view.hashes !== null ? (
            <>
              <div className={styles.seals}>
                <figure className={styles.sealFigure}>
                  <WaxSeal hash={view.hashes.stored} size={SEAL_SIZE} />
                  <figcaption>{TAMPER_COPY.storedLetter}</figcaption>
                </figure>
                <figure className={styles.sealFigure}>
                  <span className={styles.copySeal}>
                    <WaxSeal hash={view.hashes.copy} size={SEAL_SIZE} />
                    <CrackOverlay drawing={!calm} />
                  </span>
                  <figcaption>{TAMPER_COPY.copyFingerprint}</figcaption>
                </figure>
              </div>
              <p className={styles.heading}>{view.copy.heading}</p>
              <p className={styles.change}>{view.copy.change}</p>
              <p className={styles.relief}>{view.copy.reliefNotProof}</p>
              <ul className={styles.fingerprints}>
                <li className={styles.fingerprintItem}>
                  <span className={styles.fingerprintLabel}>
                    {TAMPER_COPY.storedFingerprint}
                  </span>
                  <p className={styles.fingerprintValue} translate="no">
                    {fingerprintText(view.hashes.stored)}
                  </p>
                </li>
                <li className={styles.fingerprintItem}>
                  <span className={styles.fingerprintLabel}>
                    {TAMPER_COPY.copyFingerprint}
                  </span>
                  <p className={styles.fingerprintValue} translate="no">
                    {fingerprintText(view.hashes.copy)}
                  </p>
                </li>
              </ul>
              <p className={styles.note}>{TAMPER_COPY.note}</p>
              {first !== null ? (
                <div className={styles.second} data-tamper-second-layer="">
                  <button
                    type="button"
                    className={styles.button}
                    aria-busy={second.kind === "busy"}
                    aria-describedby="tamper-second-note"
                    onClick={() => void pressSecond(first)}
                  >
                    {TAMPER_COPY.secondLayerButton}
                  </button>
                  <p id="tamper-second-note" className={styles.note}>
                    {TAMPER_COPY.secondLayerNote}
                  </p>
                  {second.kind === "done" ? (
                    <SecondLayerResult copy={second.copy} />
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <p className={styles.message}>
              {view.copy.kind === "not_as_expected"
                ? view.copy.message
                : TAMPER_COPY.notAsExpected}
            </p>
          )}
          <button type="button" className={styles.close} onClick={close}>
            {TAMPER_COPY.close}
          </button>
        </div>
      ) : null}
    </section>
  );
}
