import styles from "./WaxSeal.module.css";

type WaxSealProps = {
  /** Accessible label; empty string marks it purely decorative. */
  label?: string;
};

/**
 * A wax-seal mark rendered entirely in CSS (no image or font fetch, so it adds
 * nothing to the CSP surface). Purely decorative by default and hidden from
 * assistive tech unless a label is given. Uses the wax-seal red token; it
 * carries no directional or judgement meaning (neutrality.md).
 */
export function WaxSeal({ label }: WaxSealProps) {
  return (
    <span
      className={styles.seal}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    />
  );
}
