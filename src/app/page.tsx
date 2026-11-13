import type { CSSProperties } from "react";

import { Ghost } from "@/components/ceremony/scene/Ghost";
import { SceneShell } from "@/components/ceremony/scene/SceneShell";
import { CovenStrip } from "@/components/landing/CovenStrip";
import { LandingHero } from "@/components/landing/LandingHero";
import { NoSealSection } from "@/components/landing/NoSealSection";
import { ResurrectionSection } from "@/components/landing/ResurrectionSection";
import { RitualSection } from "@/components/landing/RitualSection";
import { PERSONAS } from "@/lib/personas";
import { pageMetadata } from "@/lib/page-metadata";

import {
  LANDING_NOSCRIPT_STYLE,
  LandingBackdrop,
} from "@/lib/landing-backdrop";

/** The landing page keeps the site title and description (see pageMetadata). */
export const metadata = pageMetadata(null, "/");

/**
 * Read per request, never at build time. Demo_2_On comes from RP_ID, which is
 * set on the cluster and not in the image build, so a prerendered page would
 * keep the build-time value (the same rule as the persona page).
 */
export const dynamic = "force-dynamic";

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
 * Landing page `/` (design.md "SceneShell, TopBar and the landing page",
 * "No JavaScript on `/`", spec 07 task 7, spec 09 B1). A server component: no
 * "use client", no Ghost, no crypto, no API or database import. It is the only
 * route that renders the Scene with `variant="landing"`.
 *
 * The LandingHero (the one h1, the Accent button to /demo and the optional
 * live-demo button) sits in the Scene with the Landing_Ghost and the light. How
 * and GitHub are linked once, in the site footer from the root layout.
 */
export default function Home() {
  const personaCount = PERSONAS.length;
  const demo2On = (process.env.RP_ID ?? "").trim() !== "";

  return (
    <>
      <noscript>
        <style>{LANDING_NOSCRIPT_STYLE}</style>
      </noscript>

      <SceneShell
        variant="landing"
        below={
          <>
            <RitualSection />
            <ResurrectionSection />
            <NoSealSection />
            <CovenStrip />
          </>
        }
      >
        <LandingBackdrop>
          <Ghost gradientId="ghost-body-landing" />
        </LandingBackdrop>
        <div style={HERO_STYLE}>
          <LandingHero personaCount={personaCount} demo2On={demo2On} />
        </div>
      </SceneShell>
    </>
  );
}
