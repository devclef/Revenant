/**
 * Date formatting for the demo pages. Pure module: no React, no DOM.
 *
 * Both formatters pin `timeZone: "UTC"` so output never depends on the
 * viewer's timezone (R6.3, R10.2, R13.3). A figure or opening date reads the
 * same whoever opens the letter and wherever they are.
 *
 * Output uses the en-GB long form, e.g. "12 May 2024".
 */
const FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Format a plain calendar date given as `YYYY-MM-DD`
 * (e.g. `persona.written_as_of`) as `"12 May 2024"`.
 *
 * The date is read at UTC midnight so the day never shifts under the viewer's
 * timezone.
 */
export function formatCalendarDate(date: string): string {
  return FORMATTER.format(new Date(`${date}T00:00:00.000Z`));
}

/**
 * Format an ISO UTC instant (e.g. `persona.opens_at`,
 * `"2024-11-05T00:00:00.000Z"`) as `"5 November 2024"`.
 */
export function formatUtcDate(instant: string): string {
  return FORMATTER.format(new Date(instant));
}
