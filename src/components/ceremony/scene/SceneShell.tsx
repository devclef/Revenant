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
import type { ReactNode } from "react";

import styles from "./scene.module.css";
import "./tokens.css";
import { TopBar } from "./TopBar";
import { SceneHeadline } from "./SceneHeadline";
import { SceneBackdrop } from "./SceneBackdrop";

export type SceneShellProps =
  | { variant: "landing"; children: ReactNode }
  | { variant: "index"; children: ReactNode }
  | { variant: "persona"; personaName: string; children: ReactNode };

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

  // The landing and index roots carry the page's one data-ceremony. `light`
  // counts as `full`, because only `calm` turns motion off (design.md "Motion
  // modes"). The index root is marked "index" (R26.4).
  const rootAttributes: Record<string, string> =
    props.variant === "persona"
      ? {}
      : {
          "data-ceremony": props.variant === "landing" ? "scene" : "index",
          "data-ceremony-motion": mode === "calm" ? "calm" : "full",
        };

  return (
    <div className={styles.scene} {...rootAttributes}>
      {/* The index variant gets the Soil backdrop from the shell, with no Ghost. */}
      {props.variant === "index" ? <SceneBackdrop /> : null}
      {props.variant === "persona" ? (
        <TopBar personaName={props.personaName} />
      ) : (
        <TopBar />
      )}
      <main className={styles.main}>
        {props.variant === "persona" ? (
          <div className={styles.personaColumn} data-persona-column>
            <SceneHeadline />
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
  );
}
