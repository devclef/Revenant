// The sealed envelope on the live Wait card (spec 09, D1 and the Wait layout).
//
// The Envelope is drawn from the sealing Fingerprint only, so its wax seal is
// the one the Keep_Section's Fingerprint describes. It is the largest element
// on the Wait card. It sits on a dark Scene light, so the paper envelope reads
// against the desk, and the children (the countdown and the other lines)
// sit directly beneath it.
//
// The Envelope is drawn in its static back pose (`turned`, no animation), so
// the seal shows in the same render. It holds no letter content: the props are
// the fingerprint and the caption nodes only.

import type { ReactNode } from "react";

import { Envelope } from "@/components/ceremony/envelope/Envelope";

import styles from "../live.module.css";

export interface SealedEnvelopeViewProps {
  /** The sealing Fingerprint (SealedState.envelopeHash). Draws the seal only. */
  envelopeHash: string;
  /** The lines directly beneath the envelope: the opening time and the countdown. */
  children?: ReactNode;
}

export function SealedEnvelopeView({
  envelopeHash,
  children,
}: SealedEnvelopeViewProps) {
  return (
    <section className={styles.envelopeView} data-sealed-envelope-view="">
      <div className={styles.envelopeLight}>
        <Envelope state="turned" animate={false} sealHash={envelopeHash} />
      </div>
      <div className={styles.envelopeLines}>{children}</div>
    </section>
  );
}
