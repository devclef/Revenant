"use client";

// Feature: 07-judge-journey
//
// The Scene shell (design.md "Providers and the Top_Bar", "SceneShell, TopBar
// and the landing page"). It renders the providers, the token CSS, the Top_Bar
// and the page content inside `main`. The page passes the backdrop and the
// content as children, and they stay server components.
//
// Exactly one `data-ceremony` per page (R2.6). The landing root carries it
// here, as "scene". The index variant (`/demo`) carries "index" here and gets
// the Soil backdrop from the shell, with no Ghost. On the persona page the
// Ceremony region carries it instead, so the shell adds none.

import { useMotion, MotionProvider } from "../motion";
import { LocalViewProvider } from "../local-view";
import { SkipProvider } from "../skip";
import { SoundEnabledContext } from "../sound/SoundEnabledContext";
import { soundCues } from "../sound/cues";
import { useState, type ReactNode } from "react";

import styles from "./scene.module.css";
import "./tokens.css";
import { TopBar, type TopBarSound } from "./TopBar";
import { SceneHeadline } from "./SceneHeadline";
import { SCENE_COPY } from "./copy";
import { SceneBackdrop } from "./SceneBackdrop";

export type SceneShellProps =
  | { variant: "landing"; children: ReactNode }
  | { variant: "index"; children: ReactNode }
  | { variant: "persona"; personaName: string; children: ReactNode }
  | {
      variant: "plain";
      /** Shows the Demo chip. Default true. */
      demo?: boolean;
      /** Which Top_Bar controls to show. Default `calm`. */
      controls?: "calm" | "none";
      children: ReactNode;
    };

export function SceneShell(props: SceneShellProps) {
  return (
    <MotionProvider>
      <SkipProvider>
        <LocalViewProvider>
          <SceneFrame {...props} />
        </LocalViewProvider>
      </SkipProvider>
    </MotionProvider>
  );
}

function SceneFrame(props: SceneShellProps) {
  const { mode } = useMotion();

  // The sound state for the page visit (spec 09 C4.4). It lives here, above the
  // persona page's content, so the Top_Bar toggle and the Seal_Break read the
  // same value. In memory only; a new visit starts off.
  const [soundOn, setSoundOn] = useState(false);
  const sound: TopBarSound | undefined =
    props.variant === "persona"
      ? {
          enabled: soundOn,
          onChange: (next) => {
            setSoundOn(next);
            soundCues.onToggle(next);
          },
        }
      : undefined;

  // The landing and index roots carry the page's one data-ceremony. `light`
  // counts as `full`, because only `calm` turns motion off (design.md "Motion
  // modes"). The index root is marked "index" (R26.4).
  const rootAttributes: Record<string, string> =
    props.variant === "persona" || props.variant === "plain"
      ? {}
      : {
          "data-ceremony": props.variant === "landing" ? "scene" : "index",
          "data-ceremony-motion": mode === "calm" ? "calm" : "full",
        };

  return (
    <SoundEnabledContext.Provider value={soundOn}>
    <div
      className={
        props.variant === "plain"
          ? `${styles.scene} ${styles.plain}`
          : styles.scene
      }
      {...rootAttributes}
    >
      {/* The index variant gets the Soil backdrop from the shell, with no Ghost. */}
      {props.variant === "index" ? <SceneBackdrop /> : null}
      {props.variant === "persona" ? (
        <TopBar personaName={props.personaName} sound={sound} />
      ) : props.variant === "plain" ? (
        <TopBar demo={props.demo ?? true} controls={props.controls ?? "calm"} />
      ) : (
        <TopBar />
      )}
      <main className={styles.main}>
        {props.variant === "persona" ? (
          <div className={styles.personaColumn} data-persona-column>
            <SceneHeadline
              text={SCENE_COPY.personaHeading.replace("{name}", props.personaName)}
            />
            {props.children}
          </div>
        ) : props.variant === "landing" ? (
          <div className={styles.landingColumn} data-landing-column>
            {props.children}
          </div>
        ) : (
          props.children
        )}
      </main>
    </div>
    </SoundEnabledContext.Provider>
  );
}
