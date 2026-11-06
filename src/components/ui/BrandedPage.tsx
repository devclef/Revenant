// Feature: 09-demo-polish, A14 (branded not-found and error pages)
//
// The shared body of the not-found and error pages. It sits on the plain Scene
// shell: the Top_Bar (wordmark and Calm, no Demo chip), the Soil_Fallback strip,
// one heading, one line of copy, an optional action, and a link to /demo.
//
// The footer is not rendered here. layout.tsx renders it after every page's
// content, and the not-found and error pages render inside that layout, so a
// second footer would appear. It loads no Soil_Canvas, crypto, card, calendar or
// Opening_Flow code.

import Link from "next/link";
import type { ReactNode } from "react";

import { SceneShell } from "@/components/ceremony/scene/SceneShell";
import { SoilStrip } from "@/components/ceremony/scene/SoilStrip";

import { UI_COPY } from "./copy";
import styles from "./BrandedPage.module.css";

export type BrandedPageProps = {
  /** The one h1 on the page. */
  heading: string;
  /** The one line of copy under the heading. */
  body: string;
  /** An optional control below the copy, for example the error page's retry button. */
  action?: ReactNode;
};

export function BrandedPage({ heading, body, action }: BrandedPageProps) {
  return (
    <SceneShell variant="plain" demo={false}>
      <SoilStrip />
      <div className={styles.page}>
        <h1 className={styles.heading}>{heading}</h1>
        <p className={styles.body}>{body}</p>
        {action === undefined ? null : <div className={styles.action}>{action}</div>}
        <p className={styles.demo}>
          <Link href="/demo" className={styles.link}>
            {UI_COPY.branded.demoLink}
          </Link>
        </p>
      </div>
    </SceneShell>
  );
}
