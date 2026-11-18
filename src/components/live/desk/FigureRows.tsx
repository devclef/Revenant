"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";

import { displayFigureValue } from "@/components/reveal/display-figure";
import { shortNameFor } from "@/components/reveal/short-names";
import { formatShortDate } from "@/components/ui/letter-date";

import { regionGroupFor, type PickableSeries } from "../catalogue-list";
import { LIVE_COPY } from "../copy";
import type { FigureDetail } from "../FigurePicker";
import { pickerHint } from "../figure-hint";
import { figureLimit } from "../form";
import { SourceDetailsList } from "../SourceDetailsList";

import { DESK_COPY } from "./copy";
import {
  figureRowName,
  figureRowPeriod,
  shortUnit,
  sourcesLine,
} from "./figure-row-text";
import styles from "./panel.module.css";

export interface FigureRowsProps {
  /** The series to offer, already in catalogue order (see listPickableSeries). */
  series: readonly PickableSeries[];
  /** Metric ids the visitor has chosen. */
  selected: readonly string[];
  /** Called with the metric id of the row the visitor pressed. */
  onToggle: (metricId: string) => void;
  /** Value and source per metric id. A row with no entry shows no value. */
  details?: ReadonlyMap<string, FigureDetail>;
}

/** The region of a row in words: the group heading, or the figure's own region. */
function regionText(region: string): string {
  const group = regionGroupFor(region);
  if (group === "us") return LIVE_COPY.regionUs;
  if (group === "eu") return LIVE_COPY.regionEu;
  return region;
}

/**
 * The Figure_Rows of the receipt card (spec 14, W11). The hint, then one
 * Picker_Note when a row is a fallback, the rows in catalogue order with no
 * region headings, the limit line, the sources line and one Details control.
 * Each row is an `aria-pressed` button. A row past the limit keeps its colours
 * and is marked `aria-disabled`, so the visitor can still see what is offered.
 */
export function FigureRows({
  series,
  selected,
  onToggle,
  details,
}: FigureRowsProps) {
  const detailsId = useId();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const limitNoteRef = useRef<HTMLParagraphElement>(null);
  const limit = figureLimit(series.length);
  const hint = pickerHint(limit);

  if (hint.key === "none") {
    const [before = "", after = ""] =
      LIVE_COPY.figuresNoneAvailable.split("{link}");
    return (
      <p className={styles.figuresNone} data-figure-rows="">
        {before}
        <Link href="/demo" className={styles.figuresNoneLink}>
          {LIVE_COPY.figuresNoneLink}
        </Link>
        {after}
      </p>
    );
  }

  const atLimit = selected.length >= limit;
  const hintText =
    hint.key === "one"
      ? LIVE_COPY.figuresHintOne
      : LIVE_COPY.figuresHint.replace("{max}", String(hint.max));
  const tooManyText =
    hint.key === "one"
      ? LIVE_COPY.figuresTooManyOne
      : LIVE_COPY.figuresTooMany.replace("{max}", String(hint.max));
  const hasFallback = series.some(
    (item) => item.fallbackRetrievedAt !== undefined,
  );

  const renderRow = (item: PickableSeries) => {
    const checked = selected.includes(item.metricId);
    const blocked = !checked && atLimit;
    const detail = details?.get(item.metricId);
    const shown =
      detail === undefined
        ? undefined
        : displayFigureValue(detail.value, detail.unit, detail.region);
    const name = shortNameFor(item.metricId, item.displayName);
    const period = figureRowPeriod(item.latestPeriod, item.periodType);
    const retrieved =
      item.fallbackRetrievedAt === undefined
        ? undefined
        : LIVE_COPY.pickerRetrieved.replace(
            "{date}",
            formatShortDate(item.fallbackRetrievedAt),
          );
    const meta = [regionText(item.region), period, retrieved]
      .filter((part): part is string => part !== undefined)
      .join(" · ");
    const valueText = shown
      ? `${shown.text} ${shortUnit(shown.unit)}`
      : shortUnit(item.unit);
    // The accessible name holds the full unit and region, not the short forms.
    const accessibleName = [
      figureRowName({
        displayName: name,
        unit: shown?.unit ?? item.unit,
        region: item.region,
      }),
      period,
      shown ? shown.text : undefined,
    ]
      .filter((part): part is string => part !== undefined)
      .join(", ");

    return (
      <li key={item.metricId}>
        <button
          type="button"
          className={styles.figureRow}
          data-figure-row=""
          aria-pressed={checked}
          aria-disabled={blocked ? "true" : undefined}
          aria-label={accessibleName}
          onClick={() => {
            // A blocked row toggles nothing. Focus moves to the limit line
            // that says why, so a second press still changes the page (X2.1).
            if (blocked) {
              limitNoteRef.current?.focus();
              return;
            }
            onToggle(item.metricId);
          }}
        >
          <span className={styles.check} aria-hidden="true" />
          <span className={styles.figureMain}>
            <span className={styles.figureName}>
              {name}
              {item.isFixture ? (
                <span className={styles.fixture}>
                  {" "}
                  {LIVE_COPY.fixtureLabel}
                </span>
              ) : null}
            </span>
            <span className={styles.figureMeta}>{meta}</span>
          </span>
          <span className={styles.figureValue}>{valueText}</span>
        </button>
      </li>
    );
  };

  return (
    <div className={styles.figureRows} data-figure-rows="">
      <p className={styles.figuresHint}>{hintText}</p>
      {hasFallback ? (
        <p className={styles.figuresHint}>{LIVE_COPY.pickerNote}</p>
      ) : null}
      <ul className={styles.figureList}>{series.map(renderRow)}</ul>
      {atLimit ? (
        <p ref={limitNoteRef} tabIndex={-1} className={styles.figuresHint}>
          {tooManyText}
        </p>
      ) : null}
      <div className={styles.sourcesRow}>
        <p className={styles.sources}>
          {sourcesLine(series.map((item) => item.source))}
        </p>
        <button
          type="button"
          className={styles.detailsButton}
          aria-expanded={detailsOpen}
          aria-controls={detailsId}
          data-figure-details=""
          onClick={() => setDetailsOpen((open) => !open)}
        >
          {DESK_COPY.details}
        </button>
      </div>
      <div id={detailsId} hidden={!detailsOpen} className={styles.details}>
        {series.map((item) => {
          const detail = details?.get(item.metricId);
          if (detail === undefined) return null;
          return (
            <div key={item.metricId} className={styles.detailsItem}>
              <p className={styles.detailsName}>
                {shortNameFor(item.metricId, item.displayName)}
              </p>
              <SourceDetailsList
                detail={detail}
                listClassName={styles.sourceList}
                noteClassName={styles.sourceNote}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
