import type { CSSProperties } from "react";
import Link from "next/link";

import { SceneHeadline } from "@/components/ceremony/scene/SceneHeadline";
import { SceneShell } from "@/components/ceremony/scene/SceneShell";
import { SCENE_COPY } from "@/components/ceremony/scene/copy";
import { PERSONAS } from "@/lib/personas";

import { LandingBackdrop } from "@/lib/landing-backdrop";

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

/** Light already up, with scripts disabled (R7.1). Constant; no user data. */
const LANDING_NOSCRIPT_STYLE = "[data-scene-light]{animation:none}";

/** The Accent button: orange means "you" (tone.md). Text is --on-accent. */
const CTA_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "56px",
  marginTop: "2rem",
  padding: "0 1.5rem",
  borderRadius: "4px",
  background: "var(--accent)",
  color: "var(--on-accent)",
  fontSize: "1.05rem",
  fontWeight: 700,
  textDecoration: "none",
};

/** Explanation paragraphs and the demo link, on the plain background. */
const EXPLAIN_STYLE: CSSProperties = {
  maxWidth: "40rem",
  margin: "0 auto",
  padding: "3rem 1.25rem 4rem",
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

  return (
    <>
      <noscript>
        <style>{LANDING_NOSCRIPT_STYLE}</style>
      </noscript>

      <SceneShell variant="landing">
        <LandingBackdrop />
        <section>
          <SceneHeadline />
          {first !== undefined && openLabel !== null ? (
            <Link href={`/demo/personas/${first.key}`} style={CTA_STYLE}>
              {openLabel}
            </Link>
          ) : null}
        </section>
      </SceneShell>

      <section style={EXPLAIN_STYLE}>
        {SCENE_COPY.landing.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <p>
          <Link href="/demo" style={DEMO_LINK_STYLE}>
            {SCENE_COPY.landing.demoLink}
          </Link>
        </p>
      </section>
    </>
  );
}
