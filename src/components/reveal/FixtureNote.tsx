import { REVEAL_COPY } from "./copy";
import styles from "./reveal.module.css";

/**
 * The fixture-data notice, shown once at the top of stage 3 when any figure in
 * the reveal is fixture data (R13.5, data-integrity.md). It states plainly that
 * some figures were made up for building the demo and are not real prices, so a
 * reader can never mistake a fixture figure for a real one. The per-figure
 * "fixture data" label on each fixture figure is separate (FigureLine) and this
 * note does not replace it.
 *
 * The single string comes from copy.ts (R15.1). This component holds no state,
 * reads no clock, logs nothing and touches no storage.
 */
export function FixtureNote() {
  return <p className={styles.fixtureNote}>{REVEAL_COPY.fixtureNote}</p>;
}
