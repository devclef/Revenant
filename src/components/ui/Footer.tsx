// Feature: 08-judge-polish (R12)
//
// The site footer, rendered once by layout.tsx after the page content. A server
// component with no client JavaScript. It sits on the desk background (--bg) and
// sets its own text colour, so no colour is inherited from the page above.

import Link from "next/link";
import type { CSSProperties } from "react";

import { FOOTER_MAX_PX } from "@/components/ceremony/constants";
import "@/components/ceremony/scene/tokens.css";

import { UI_COPY } from "./copy";
import styles from "./Footer.module.css";

/** The GitHub repository linked from the footer. */
export const FOOTER_SOURCE_URL = "https://github.com/devclef/Revenant";

/**
 * Stacked above the fixed Soil strip (z-index 3). The strip is fixed between
 * 74 and 88vh, so with the page scrolled to its end the footer sits in the last
 * FOOTER_MAX_PX pixels and does not meet it (R12.6).
 */
const FOOTER_STYLE: CSSProperties = {
  position: "relative",
  zIndex: 3,
  background: "var(--bg)",
  color: "var(--text)",
  boxSizing: "border-box",
  maxHeight: `${FOOTER_MAX_PX}px`,
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "0.9rem",
  lineHeight: 1.4,
};

/**
 * The links set their colour here. The global `a` rule is wax-seal red, which
 * would not meet AA on --bg. --text (#f5f3ff) on --bg (#0b0912) does.
 */
const LINK_STYLE: CSSProperties = {
  color: "var(--text)",
};

export function Footer() {
  return (
    <footer className={styles.footer} style={FOOTER_STYLE}>
      <Link href="/how-it-is-sealed" className={styles.link} style={LINK_STYLE}>
        {UI_COPY.footer.how}
      </Link>
      <a
        href={FOOTER_SOURCE_URL}
        rel="noopener noreferrer"
        className={styles.link}
        style={LINK_STYLE}
      >
        {UI_COPY.footer.source}
      </a>
    </footer>
  );
}
