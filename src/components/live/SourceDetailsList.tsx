import { REVEAL_COPY } from "@/components/reveal/copy";
import { formatShortDate } from "@/components/ui/letter-date";

import type { FigureDetail } from "./FigurePicker";
import { LIVE_COPY } from "./copy";
import styles from "./live.module.css";

export interface SourceDetailsListProps {
  /** The figure whose source lines are shown. */
  detail: FigureDetail;
  /** Class of the definition list. Defaults to the picker's list style. */
  listClassName?: string;
  /** Class of the "as published" line. Defaults to the picker's meta style. */
  noteClassName?: string;
}

/**
 * The source lines of one figure: source name, series ID, source link and the
 * retrieved date, then the value as published with its unit (spec 14, W11.8).
 * The Figure_Picker and the receipt rows on the Write desk render the same
 * lines through this component. The caller supplies the surrounding
 * disclosure.
 */
export function SourceDetailsList({
  detail,
  listClassName = styles.sourceList,
  noteClassName = styles.figureMeta,
}: SourceDetailsListProps) {
  return (
    <>
      <dl className={listClassName}>
        <dt>{LIVE_COPY.figureSourceName}</dt>
        <dd>{detail.sourceName}</dd>
        <dt>{LIVE_COPY.figureSeriesId}</dt>
        <dd>{detail.seriesId}</dd>
        <dt>{LIVE_COPY.figureSourceLink}</dt>
        <dd>
          <a href={detail.sourceUrl} rel="noopener noreferrer">
            {detail.sourceUrl}
          </a>
        </dd>
        <dt>{LIVE_COPY.figureRetrieved}</dt>
        <dd>{formatShortDate(detail.retrievedAt)}</dd>
      </dl>
      <p className={noteClassName}>
        {REVEAL_COPY.asPublished
          .replace("{value}", detail.value)
          .replace("{unit}", detail.unit)}
      </p>
    </>
  );
}
