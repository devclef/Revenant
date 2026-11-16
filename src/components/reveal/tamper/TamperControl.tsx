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
import { TAMPER_COPY, tamperResultCopy, type TamperResultCopy } from "./tamper-copy";
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
      readonly hashes: { readonly stored: string; readonly copy: string } | null;
    };

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

export function TamperControl({ getSource }: TamperControlProps) {
  const [view, setView] = useState<View>({ kind: "idle" });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const calm = useCalmInForce();

  // Runs the real check. `runTamper` is loaded on the first press only, so the
  // tamper module stays out of the first-load JavaScript of the persona page.
  async function press() {
    const source = getSource();
    setView({ kind: "busy" });
    if (source === null) {
      setView({
        kind: "result",
        copy: { kind: "not_as_expected", message: TAMPER_COPY.notAsExpected },
        hashes: null,
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
      });
    } catch {
      // A thrown run is a broken setup. It is shown as the plain message, never
      // as a cracked seal.
      setView({
        kind: "result",
        copy: { kind: "not_as_expected", message: TAMPER_COPY.notAsExpected },
        hashes: null,
      });
    }
  }

  // Closing clears this control's view and returns focus to the control.
  function close() {
    setView({ kind: "idle" });
    buttonRef.current?.focus();
  }

  const busy = view.kind === "busy";

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
