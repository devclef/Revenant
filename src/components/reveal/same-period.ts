// The Same_Period_Line (spec 14, R7.2). It is the one line shown on a
// same-period receipt on a live or real letter, in place of the change line.
//
// It reads the sealed period string only. YYYY-MM-DD is a week, YYYY-MM is a
// month, and any other string is a period. It never reads the catalogue, so a
// letter says the same thing whatever the Catalogue holds.
//
// This module imports nothing from src/lib/crypto, src/lib/db or Node
// built-ins, so it is pure and safe to use in the browser and on the server.

import { REVEAL_COPY } from "./copy";

const WEEK_PERIOD = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PERIOD = /^\d{4}-\d{2}$/;

/** The Same_Period_Line for one sealed period string. */
export function samePeriodLine(period: string): string {
  if (WEEK_PERIOD.test(period)) return REVEAL_COPY.samePeriodWeek;
  if (MONTH_PERIOD.test(period)) return REVEAL_COPY.samePeriodMonth;
  return REVEAL_COPY.samePeriodOther;
}
