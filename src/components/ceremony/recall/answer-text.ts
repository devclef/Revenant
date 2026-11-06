// Feature: 09 (spec 09 A9): one answer format for the marks card.
//
// answerText shows a Recall_Record value the way it was stored. Every digit is
// kept, the integer part is grouped with commas, and nothing is rounded or
// dropped: 3.90 stays 3.90 and 1000 becomes 1,000.
//
// Pure module: no DOM, locale, clock or state.

/**
 * Format a stored Recall_Record value (a plain decimal string such as "1000"
 * or "3.90") for display. The input is returned with its integer part grouped
 * in threes and every fractional digit kept as stored.
 */
export function answerText(value: string): string {
  const dot = value.indexOf(".");
  const integer = dot === -1 ? value : value.slice(0, dot);
  const fraction = dot === -1 ? "" : value.slice(dot);
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return grouped + fraction;
}
