import type { ReactNode } from "react";
import styles from "./PageShell.module.css";

type PageShellProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Centres page content in a comfortable reading column with generous negative
 * space (tone.md). Pure presentational server component. The inner column width
 * is bounded so letters and copy stay readable on wide screens.
 */
export function PageShell({ children, className }: PageShellProps) {
  const classes = [styles.shell, className].filter(Boolean).join(" ");
  return (
    <main className={classes}>
      <div className={styles.column}>{children}</div>
    </main>
  );
}
