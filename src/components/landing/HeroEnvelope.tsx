// Feature: 09-demo-polish (landing hero seal, issue #429, L1 and L3)
//
// The seal drawn on the landing hero envelope. It is a server component: it
// renders the shared Envelope on its turned face with the fixed
// LANDING_SEAL_HASH, so the relief paths are in the server HTML. It names no
// letter, shows no Fingerprint text and carries no persona. The hash belongs
// to no letter (see constants.ts).
//
// The sheet Ghost (L2, issue #433) sits behind the envelope, in the page flow.
// It is clipped to the seal frame, so it widens past the envelope on both
// sides and never reaches the seal, the h1 or a control. The seal and the
// envelope draw in front of it.
//
// The box is sized in landing.module.css: the envelope is at most 420 px wide,
// and the seal inside it is scaled by 2 from its 64-unit SVG. Measured in
// Chromium, it renders at 165.6 CSS px at 1440 px wide and 125.4 CSS px at
// 390 px wide. Nothing here is a canvas, an image or a script.

import type { ReactElement } from "react";

import { Envelope } from "@/components/ceremony/envelope/Envelope";
import { Ghost } from "@/components/ceremony/scene/Ghost";

import { LANDING_SEAL_HASH } from "./constants";
import styles from "./landing.module.css";

export function HeroEnvelope(): ReactElement {
  return (
    <div className={styles.sealBox} data-landing-seal>
      <div className={styles.heroGhost} data-hero-ghost aria-hidden="true">
        <Ghost
          gradientId="ghost-body-hero"
          rootAttributes={{ "data-hero-pit": "" }}
        />
      </div>
      <div className={styles.sealFrame}>
        <Envelope state="turned" animate={false} sealHash={LANDING_SEAL_HASH} />
      </div>
    </div>
  );
}
