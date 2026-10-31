import styles from "./Wordmark.module.css";

type WordmarkProps = {
  /** The tagline shown beneath the name. Optional. */
  tagline?: string;
};

/**
 * The Revenant name set in the serif display face, with an optional tagline.
 * Pure presentational server component. The name is an <h1>, so each page using
 * it keeps a single top-level heading.
 */
export function Wordmark({ tagline }: WordmarkProps) {
  return (
    <div className={styles.wordmark}>
      <h1 className={styles.name}>Revenant</h1>
      {tagline ? <p className={styles.tagline}>{tagline}</p> : null}
    </div>
  );
}
