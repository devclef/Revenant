"use client";

// Feature: 07-judge-journey
//
// The Scene shell (design.md "Providers and the Top_Bar", "SceneShell, TopBar
// and the landing page"). It renders the providers, the token CSS, the Top_Bar
// and the page content inside `main`. The page passes the backdrop and the
// content as children, and they stay server components.
//
// Exactly one `data-ceremony` per page (R2.6). The landing root carries it
// here. On the persona page the Ceremony region carries it instead, so the
// shell adds none.

import { useMotion, MotionProvider } from "../motion";
import { LocalViewProvider } from "../local-view";
import { SkipProvider } from "../skip";
import type { ReactNode } from "react";

import styles from "./scene.module.css";
import "./tokens.css";
import { TopBar } from "./TopBar";
import { SceneHeadline } from "./SceneHeadline";

export type SceneShellProps =
  | { variant: "landing"; children: ReactNode }
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

  // The landing root carries the page's one data-ceremony. `light` counts as
  // `full`, because only `calm` turns motion off (design.md "Motion modes").
  const rootAttributes: Record<string, string> =
    props.variant === "landing"
      ? {
          "data-ceremony": "scene",
          "data-ceremony-motion": mode === "calm" ? "calm" : "full",
        }
      : {};

  return (
    <div className={styles.scene} {...rootAttributes}>
      {props.variant === "persona" ? (
        <TopBar personaName={props.personaName} />
      ) : (
        <TopBar />
      )}
      <main className={styles.main}>
        {props.variant === "persona" ? (
          <div className={styles.personaColumn}>
            <SceneHeadline />
            {props.children}
          </div>
        ) : (
          props.children
        )}
      </main>
    </div>
  );
}
