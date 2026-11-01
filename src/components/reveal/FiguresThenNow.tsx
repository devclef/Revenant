import type { FigureV1 } from "@/lib/seal-format";
import type { DisplayRescale } from "@/lib/figures";
import { computeChange, isFixtureFigure } from "@/lib/figures";
import { DEMO_FIGURES } from "@/lib/figures/demo";
import { thenAndNow } from "@/lib/figures/then-now";
import type { Opened } from "./opening-machine";
import { ChangeLine } from "./ChangeLine";
import { FigureLine } from "./FigureLine";
import { FixtureNote } from "./FixtureNote";
import { REVEAL_COPY } from "./copy";
import styles from "./reveal.module.css";

/**
 * Stage 3 of the reveal (design.md "Reveal", R11-R13): the sealed figures then
 * and the catalogue's figures now, one metric per entry, in the exact order the
 * figures were sealed.
 *
 * For each sealed figure, in payload order:
 *
 * - The metric's display name is looked up from the sealed `payload.metrics`
 *   (never the live catalogue), so a letter still names its metric even if the
 *   catalogue has changed (data-integrity.md). A figure whose metric_id is not
 *   declared is skipped; the sealed-letter schema forbids that, so it cannot
 *   happen for a validly sealed letter.
 * - The sealed "then" figure comes from the payload only and is shown with
 *   {@link FigureLine} (role "then").
 * - The "now" figure is looked up in {@link DEMO_FIGURES} (a static import, no
 *   network) with `thenAndNow(metricId, sealedAt.slice(0,10), DEMO_FIGURES).now`
 *   — the latest figure in that series. A missing now shows
 *   `nowUnavailableUnknown` (the series left the catalogue) or
 *   `nowUnavailableEmpty` (the series has no figures), and no change (R6.5,
 *   R6.6, data-integrity.md). An honest gap, never a filled one.
 * - When both figures are present, {@link computeChange} decides comparability.
 *   Not comparable: both figures are shown with their own periods, plus the one
 *   neutral reason sentence for the first failing check (R12.x,
 *   data-integrity.md). Comparable: a single {@link ChangeLine} (R12.9).
 *
 * The display rescale (if any) comes from the series as loaded in
 * `DEMO_FIGURES` and is passed to each {@link FigureLine}; it is display-only
 * and never changes a stored value (R11.10). The sealed "then" figure uses the
 * same series rescale so then and now read in the same unit.
 *
 * {@link FixtureNote} is rendered once at the top when any shown figure is a
 * fixture (`isFixtureFigure`, R13.5). The per-figure "fixture data" label is
 * separate and lives on each {@link FigureLine} / {@link ChangeLine}.
 *
 * Every string comes from copy.ts; no letter text or figure value is an
 * authored literal (R15.1). This component reads no clock, holds no state, logs
 * nothing and makes no network request: `sealedAt` comes from the opened
 * letter's header and `DEMO_FIGURES` is a frozen import.
 */

export type FiguresThenNowProps = {
  /** The opened letter; its payload holds the sealed figures and metrics. */
  opened: Opened;
};

// The copy for a missing "now" figure, by the reason thenAndNow reports. A
// series that left the catalogue is unknown; a series with no figures (or no
// figure at or before the date, which cannot occur for "now") is empty.
function missingNowCopy(
  reason: "unknown_series" | "no_figures" | "none_at_or_before_date",
): string {
  return reason === "unknown_series"
    ? REVEAL_COPY.nowUnavailableUnknown
    : REVEAL_COPY.nowUnavailableEmpty;
}

export function FiguresThenNow({ opened }: FiguresThenNowProps) {
  const { payload, header } = opened;

  // The reference date for "now" is the UTC calendar date the letter was
  // sealed; sealedAt is a millisecond-`Z` instant, so its date is the first ten
  // characters (already UTC).
  const sealedDate = header.sealedAt.slice(0, 10);

  const metricName = new Map<string, string>();
  for (const metric of payload.metrics) {
    metricName.set(metric.id, metric.display_name);
  }

  // Build each entry up front so we can decide the fixture note from every
  // figure actually shown, then render.
  type Entry = {
    key: string;
    name: string;
    then: Readonly<FigureV1>;
    now: Readonly<FigureV1> | undefined;
    nowMissing: string | undefined;
    rescale: Readonly<DisplayRescale> | undefined;
    change: ReturnType<typeof computeChange> | undefined;
  };

  const entries: Entry[] = [];
  let anyFixture = false;

  payload.figures.forEach((then, index) => {
    const name = metricName.get(then.metric_id);
    // A figure with no matching metric cannot occur for a validly sealed letter
    // (the schema enforces it); skip defensively rather than invent a name.
    if (name === undefined) return;

    const series = DEMO_FIGURES.series.get(then.metric_id);
    const rescale = series?.display_rescale;

    const result = thenAndNow(then.metric_id, sealedDate, DEMO_FIGURES);
    const now = result.now.found ? result.now.figure : undefined;
    const nowMissing = result.now.found
      ? undefined
      : missingNowCopy(result.now.reason);

    const change = now === undefined ? undefined : computeChange(then, now);

    if (isFixtureFigure(then)) anyFixture = true;
    if (now !== undefined && isFixtureFigure(now)) anyFixture = true;

    entries.push({
      // metric_id is unique per payload, but index keeps the key stable even if
      // that ever changes.
      key: `${then.metric_id}-${index}`,
      name,
      then,
      now,
      nowMissing,
      rescale,
      change,
    });
  });

  return (
    <section className={styles.figuresThenNow}>
      <h2>{REVEAL_COPY.stage3Title}</h2>

      {anyFixture ? <FixtureNote /> : null}

      {entries.map((entry) => (
        <div key={entry.key} className={styles.figureGroup}>
          <h3 className={styles.metricName}>{entry.name}</h3>

          {entry.now === undefined ? (
            // No now figure: show the sealed then figure and say, plainly, why
            // the current figure is unavailable. No change is shown.
            <>
              <p className={styles.then}>{REVEAL_COPY.then}</p>
              <FigureLine
                figure={entry.then}
                role="then"
                displayRescale={entry.rescale}
              />
              <p className={styles.period}>{entry.nowMissing}</p>
            </>
          ) : entry.change !== undefined && entry.change.comparable ? (
            // Comparable: one neutral change line (the then and now periods are
            // part of it). The raw then and now figures are still shown so the
            // reader can reach each figure's provenance.
            <>
              <p className={styles.then}>{REVEAL_COPY.then}</p>
              <FigureLine
                figure={entry.then}
                role="then"
                displayRescale={entry.rescale}
              />
              <p className={styles.now}>{REVEAL_COPY.now}</p>
              <FigureLine
                figure={entry.now}
                role="now"
                displayRescale={entry.rescale}
              />
              <ChangeLine
                result={entry.change}
                region={entry.then.region}
                then={entry.then}
                now={entry.now}
              />
            </>
          ) : (
            // Not comparable: both figures with their own periods, plus the one
            // neutral reason sentence for the first failing check.
            <>
              <p className={styles.then}>{REVEAL_COPY.then}</p>
              <FigureLine
                figure={entry.then}
                role="then"
                displayRescale={entry.rescale}
              />
              <p className={styles.now}>{REVEAL_COPY.now}</p>
              <FigureLine
                figure={entry.now}
                role="now"
                displayRescale={entry.rescale}
              />
              <p className={styles.period}>{REVEAL_COPY.notComparable}</p>
              {entry.change !== undefined && !entry.change.comparable ? (
                <p className={styles.period}>
                  {REVEAL_COPY.reason[entry.change.reason]}
                </p>
              ) : null}
            </>
          )}
        </div>
      ))}
    </section>
  );
}
