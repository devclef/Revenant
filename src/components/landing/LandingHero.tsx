// Feature: 09-demo-polish, landing hero (B1.1 to B1.5, B2.1, B2.3, P1.1, B4)
//
// The landing hero, as a server component. It renders the Eyebrow, the
// Tagline as the page's h1, the Hero_Sentence and the calls to action. It
// takes only the Persona_List length and Demo_2_On, so no persona's name,
// region or letter link can reach the markup (B2.1). It makes no request and
// uses no storage (B2.3).
//
// The primary call to action is the only Accent button. It links to /demo.
// With no persona there is no primary call to action. The secondary call to
// action, to the live demo, shows only while Demo_2_On (B1.2 to B1.4).
//
// The Landing_Ghost box is reserved here, after the calls to action, so the
// server HTML holds its place (OD12 c, CLS 0). The ghost itself is drawn by
// the page. `primaryCost` is not rendered yet; see constants.ts for why.

import Link from "next/link";

import { BRAND_COPY } from "@/components/brand/copy";
import { splitTagline } from "@/components/ceremony/scene/SceneHeadline";

import { LANDING_COPY } from "./copy";
import styles from "./landing.module.css";

export type LandingHeroProps = {
  /** The number of entries in the Persona_List. Zero shows no primary button. */
  personaCount: number;
  /** Whether the live demo (Demo 2) is on. Shows the secondary call to action. */
  demo2On: boolean;
};

export function LandingHero({ personaCount, demo2On }: LandingHeroProps) {
  const { before, kept } = splitTagline(BRAND_COPY.tagline);
  // One persona gets the singular label. Two or more get the plural.
  const primaryLabel =
    personaCount === 1 ? LANDING_COPY.primaryCtaOne : LANDING_COPY.primaryCtaMany;

  return (
    <section className={styles.hero} data-landing-hero>
      <p className={styles.eyebrow} data-block="eyebrow">
        {BRAND_COPY.eyebrow}
      </p>
      <h1 className={styles.headline} data-block="headline">
        {before}
        {kept === "" ? null : <span className={styles.keep}>{kept}</span>}
      </h1>
      <p className={styles.sentence} data-block="sentence">
        {BRAND_COPY.heroSentence}
      </p>
      <div className={styles.actions} data-block="actions">
        {personaCount >= 1 ? (
          <Link
            href="/demo"
            className={`${styles.cta} ${styles.accent}`}
            data-cta="primary"
          >
            {primaryLabel}
          </Link>
        ) : null}
        {demo2On ? (
          <Link
            href="/demo/live"
            className={`${styles.cta} ${styles.outlined}`}
            data-cta="secondary"
          >
            {LANDING_COPY.secondaryCta}
          </Link>
        ) : null}
      </div>
      <div className={styles.ghost} data-block="ghost" aria-hidden="true" />
    </section>
  );
}
