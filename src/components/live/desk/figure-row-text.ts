// Text helpers for the receipt rows (Figure_Rows) and their source line on the
// Write desk (spec 14, W10). Plain copy only: no change, direction or judgement
// words (neutrality.md). Pure module: no I/O, no locale or time-zone lookups,
// so the output is the same in every browser.

import type { PeriodType } from "@/lib/figures/types";

import { SHORT_PUBLISHERS } from "./short-publishers";
import { shortUnit } from "./short-units";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const DAY_PERIOD = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_PERIOD = /^(\d{4})-(\d{2})(?:-\d{2})?$/;

/** The short form of a publisher, or the full source when it has no short name. */
export function shortPublisher(source: string): string {
  return SHORT_PUBLISHERS.get(source) ?? source;
}

/**
 * The period of a receipt row in plain words. A weekly period (a day, for
 * example "2026-11-09") reads "week of 9 Nov". A monthly period reads "Nov
 * 2026". A period that does not parse is returned as it was published.
 */
export function figureRowPeriod(
  period: string,
  periodType: PeriodType,
): string {
  if (periodType === "weekly") {
    const match = DAY_PERIOD.exec(period);
    if (match !== null) {
      const month = Number(match[2]);
      const day = Number(match[3]);
      const name = MONTHS[month - 1];
      if (name !== undefined && day >= 1 && day <= 31) {
        return `week of ${day} ${name}`;
      }
    }
    return period;
  }

  const match = MONTH_PERIOD.exec(period);
  if (match !== null) {
    const month = Number(match[2]);
    const name = MONTHS[month - 1];
    if (name !== undefined) return `${name} ${match[1]}`;
  }
  return period;
}

/**
 * The source line under the Figure_Rows, for example "Sources: U.S. EIA · EU
 * Weekly Oil Bulletin." Each publisher is named once, in the order given.
 * Returns "" when there are no sources.
 */
export function sourcesLine(sources: readonly string[]): string {
  const names = [...new Set(sources.map(shortPublisher))];
  if (names.length === 0) return "";
  return `Sources: ${names.join(" · ")}.`;
}

/**
 * The accessible name of a receipt row. It holds the full unit and the row's
 * own region, not the short forms shown on screen, so a screen reader hears
 * the same facts a sighted reader sees in full.
 */
export function figureRowName(row: {
  displayName: string;
  unit: string;
  region: string;
}): string {
  return `${row.displayName}, ${row.unit}, ${row.region}`;
}

/** The short unit shown on a receipt row. Re-exported so rows import one module. */
export { shortUnit };
