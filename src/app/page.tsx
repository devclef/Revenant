import type { CSSProperties } from "react";
import Link from "next/link";

import { Ghost } from "@/components/ceremony/scene/Ghost";
import { SceneHeadline } from "@/components/ceremony/scene/SceneHeadline";
import { SceneShell } from "@/components/ceremony/scene/SceneShell";
import { SCENE_COPY } from "@/components/ceremony/scene/copy";
import styles from "@/components/ceremony/scene/scene.module.css";
import { PERSONAS } from "@/lib/personas";
import { pageMetadata } from "@/lib/page-metadata";

import {
  LANDING_NOSCRIPT_STYLE,
  LandingBackdrop,
} from "@/lib/landing-backdrop";

/** The landing page keeps the site title and description (see pageMetadata). */
export const metadata = pageMetadata(null, "/");

/** The GitHub repository linked from the landing page. */
const GITHUB_URL = "https://github.com/devclef/Revenant";

/** Link style on the dark --bg surface, as in DEMO_LINK_STYLE. */
const LINK_STYLE: CSSProperties = {
  color: "var(--text)",
};

/**
 * Landing page `/` (design.md "SceneShell, TopBar and the landing page",
 * "No JavaScript on `/`", spec 07 task 7). A server component: no "use client",
 * no Ghost, no crypto, no API or database import. It is the only route that
 * renders the Scene with `variant="landing"`.
 *
 * The hero (the one h1 and the Accent button) sits in the Scene. The
 * explanation and the `/demo` link come after the Scene, on the plain
 * background below the Soil strip. Every word comes from SCENE_COPY.
 */

/**
 * The Accent button: orange means "you" (tone.md). Text is --on-accent. The top
 * margin is not set here: the `.landingColumn .landingCta` rule in
 * scene.module.css sets it, so the narrow layout keeps the button below the
 * Soil strip (an inline margin would override that rule).
 */
const CTA_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "56px",
  padding: "0 1.5rem",
  borderRadius: "4px",
  background: "var(--accent)",
  color: "var(--on-accent)",
  fontSize: "1.05rem",
  fontWeight: 700,
  textDecoration: "none",
};

/**
 * The hero sits above the backdrop. The backdrop is a positioned layer
 * (z-index 0) inside the same <main>, so without its own stacking order the
 * dust, light and Soil strip paint over the headline and the Accent button
 * (tone.md: dust never sits on text, C1).
 */
const HERO_STYLE: CSSProperties = {
  position: "relative",
  zIndex: 1,
};

/**
 * Explanation paragraphs and the demo link, on a solid --bg surface stacked
 * above the fixed backdrop, so the Soil strip never draws over this text when
 * the page is scrolled (C1).
 */
const EXPLAIN_STYLE: CSSProperties = {
  position: "relative",
  zIndex: 2,
  background: "var(--bg)",
  padding: "3rem 0 4rem",
  paddingInline: "max(1.25rem, calc((100% - 40rem) / 2))",
  color: "var(--text)",
  fontSize: "1.05rem",
  lineHeight: 1.6,
};

/**
 * The /demo link on the dark --bg surface. The global `a` rule is wax-seal red,
 * so the colour is set here: --text (#f5f3ff) is white on --bg (#0b0912), well
 * above WCAG 2.2 AA. The underline takes the same colour (currentColor), so it
 * is not red either.
 */
const DEMO_LINK_STYLE: CSSProperties = {
  color: "var(--text)",
};

export default function Home() {
  const first = PERSONAS[0];
  const openLabel =
    first === undefined
      ? null
      : SCENE_COPY.openLetter.replace("{name}", first.display_name);
  // One persona gets the singular link text. Two or more, or none, get the plural.
  const demoLinkLabel =
    PERSONAS.length === 1
      ? SCENE_COPY.landing.demoLinkOne
      : SCENE_COPY.landing.demoLinkMany;

  return (
    <>
      <noscript>
        <style>{LANDING_NOSCRIPT_STYLE}</style>
      </noscript>

      <SceneShell variant="landing">
        <LandingBackdrop>
          <Ghost gradientId="ghost-body-landing" />
        </LandingBackdrop>
        <section style={HERO_STYLE}>
          <SceneHeadline />
          {first !== undefined && openLabel !== null ? (
            <Link
              href={`/demo/personas/${first.key}`}
              className={styles.landingCta}
              style={CTA_STYLE}
            >
              {openLabel}
            </Link>
          ) : null}
        </section>
      </SceneShell>

      <section style={EXPLAIN_STYLE}>
        <p>{SCENE_COPY.landing.paragraphs[0]}</p>
        <p>{SCENE_COPY.landing.paragraphs[1]}</p>
        <p>
          <Link href="/demo" style={DEMO_LINK_STYLE}>
            {demoLinkLabel}
          </Link>
        </p>
        <p>
          <Link href="/demo/live" style={LINK_STYLE}>
            {SCENE_COPY.landing.liveLink}
          </Link>{" "}
          <span>{SCENE_COPY.landing.liveNote}</span>
        </p>
        <p>
          <Link href="/how-it-is-sealed" style={LINK_STYLE}>
            {SCENE_COPY.landing.howLink}
          </Link>
        </p>
        <p>
          <a href={GITHUB_URL} rel="noopener noreferrer" style={LINK_STYLE}>
            {SCENE_COPY.landing.sourceLink}
          </a>
        </p>
      </section>
    </>
  );
}
