// Test helper (spec 08 task 2): removes the Number_Line's visible labels from
// rendered markup so the skeleton comparisons in the reveal property tests
// still compare everything else byte for byte.
//
// The labels carry text that depends on the answer ("Your answer" and the
// value, or "No answer") and positions in px that depend on where the
// answer sits. The Number_Line's text alternative (its aria-label) names the
// then, now and answer values. In a skeleton its numbers become "#" and its
// answer clause becomes "ANSWER." These are the parts the spec allows to
// differ, the same way the Mark's position and text are masked. Tags, classes
// and copy of every other element are left as they are.

// One label span: a `data-line-label` span with either text or the two
// line spans of the answer label inside it.
const LINE_LABEL =
  /<span[^>]*data-line-label="[^"]*"[^>]*>(?:<span[^>]*>[^<]*<\/span>|[^<]*)*<\/span>/g;

// The Number_Line root's text alternative. Only the Number_Line has role="img".
const NUMBER_LINE_ALT = /role="img" aria-label="([^"]*)"/g;

function skeletonAlt(alt: string): string {
  return alt
    .replace(/Your answer .*$/, "ANSWER.")
    .replace(/No answer\.$/, "ANSWER.")
    .replace(/[+−-]?[0-9][0-9.,\u00a0\u202f]*/g, "#");
}

export function maskLineLabels(html: string): string {
  return html
    .replace(LINE_LABEL, "")
    .replace(NUMBER_LINE_ALT, (_match, alt: string) => `role="img" aria-label="${skeletonAlt(alt)}"`);
}
