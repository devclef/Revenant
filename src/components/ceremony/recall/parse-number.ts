// The Recall_Number_Parser: the only code that reads what a judge typed in the
// recall number field (spec 08 design.md, "The Recall_Number_Parser", R32).
//
// Every digit is kept. Nothing is rounded, and no leading or trailing zero is
// dropped. The output is a canonical plain decimal, `^[0-9]+(\.[0-9]+)?$`, which
// the Recall_Record number pattern accepts. A text that could mean two numbers
// (an Ambiguous_Input) is never given a value. The caller asks the judge.
//
// Pure module: no DOM, locale, clock or state.

/** The six Unambiguous_Formats. */
export type UnambiguousFormat =
  | "digits" // 1. "1585"
  | "point" // 2. "1585.76"
  | "comma" // 3. "1585,76", "0,585"
  | "comma_grouped" // 4. "1,585.76", "1,585,760"
  | "dot_grouped" // 5. "1.585,76", "1.585.760"
  | "space_grouped"; // 6. "1 585,76", "1 585"

/** The result of parsing one piece of text. */
export type RecallNumberParse =
  | { kind: "value"; value: string; format: UnambiguousFormat }
  | {
      kind: "ambiguous";
      head: string;
      tail: string;
      decimal: string;
      grouping: string;
    }
  | { kind: "rejected"; reason: "empty" | "unreadable" | "too_long" };

/** The longest canonical value the Recall_Record accepts. */
const MAX_CANONICAL_LENGTH = 40;

/** Ambiguous_Input: one to three digits, one separator, exactly three digits. */
const AMBIGUOUS = /^([1-9][0-9]{0,2})[.,]([0-9]{3})$/;

/** The first group of a grouped format: one to three digits, no leading zero. */
const G = "[1-9][0-9]{0,2}";
/** Exactly one space character: a regular space, no-break space or narrow no-break space. */
const S = "[ \u00A0\u202F]";

const FORMATS: ReadonlyArray<{
  format: UnambiguousFormat;
  pattern: RegExp;
  canonical: (text: string) => string;
}> = [
  { format: "digits", pattern: /^[0-9]+$/, canonical: (t) => t },
  { format: "point", pattern: /^[0-9]+\.[0-9]+$/, canonical: (t) => t },
  {
    format: "comma",
    pattern: /^[0-9]+,[0-9]+$/,
    canonical: (t) => t.replace(",", "."),
  },
  {
    format: "comma_grouped",
    pattern: new RegExp(`^${G}(,[0-9]{3})+(\\.[0-9]+)?$`),
    canonical: (t) => t.replace(/,/g, ""),
  },
  {
    format: "dot_grouped",
    pattern: new RegExp(`^${G}(\\.[0-9]{3})+(,[0-9]+)?$`),
    canonical: (t) => t.replace(/\./g, "").replace(",", "."),
  },
  {
    format: "space_grouped",
    pattern: new RegExp(`^${G}(${S}[0-9]{3})+(,[0-9]+)?$`),
    canonical: (t) => t.replace(/[ \u00A0\u202F]/g, "").replace(",", "."),
  },
];

/**
 * Parse the text of the recall number field.
 *
 * Steps, in order: trim; empty is rejected; an Ambiguous_Input is returned
 * before any format is tried; then the six formats; anything else is
 * unreadable; a canonical value over 40 characters is too long.
 */
export function parseRecallNumber(text: string): RecallNumberParse {
  const trimmed = text.trim();
  if (trimmed === "") return { kind: "rejected", reason: "empty" };

  const ambiguous = AMBIGUOUS.exec(trimmed);
  if (ambiguous) {
    const [, head, tail] = ambiguous;
    return {
      kind: "ambiguous",
      head,
      tail,
      decimal: `${head}.${tail}`,
      grouping: `${head}${tail}`,
    };
  }

  for (const { format, pattern, canonical } of FORMATS) {
    if (!pattern.test(trimmed)) continue;
    const value = canonical(trimmed);
    if (value.length > MAX_CANONICAL_LENGTH) {
      return { kind: "rejected", reason: "too_long" };
    }
    return { kind: "value", value, format };
  }

  return { kind: "rejected", reason: "unreadable" };
}

/** Group an integer string from the right in threes with `sep`. */
function groupInteger(int: string, sep: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

/**
 * A canonical value written in one format, or null when that format cannot
 * write it, or when the result would parse as an Ambiguous_Input.
 *
 * - `digits` needs no fraction; `point` and `comma` need one.
 * - The grouped formats need an integer part of at least four digits with no
 *   leading zero. They group it in threes and write the fraction after the
 *   format's decimal separator.
 * - `space_grouped` uses `space` as its separator (default U+0020).
 */
export function formatRecallNumber(
  value: string,
  format: UnambiguousFormat,
  space: " " | "\u00A0" | "\u202F" = " ",
): string | null {
  const dot = value.indexOf(".");
  const int = dot === -1 ? value : value.slice(0, dot);
  const frac = dot === -1 ? null : value.slice(dot + 1);
  const grouped = int.length >= 4 && int[0] !== "0";

  let written: string | null;
  switch (format) {
    case "digits":
      written = frac === null ? value : null;
      break;
    case "point":
      written = frac === null ? null : value;
      break;
    case "comma":
      written = frac === null ? null : `${int},${frac}`;
      break;
    case "comma_grouped":
      written = grouped
        ? groupInteger(int, ",") + (frac === null ? "" : `.${frac}`)
        : null;
      break;
    case "dot_grouped":
      written = grouped
        ? groupInteger(int, ".") + (frac === null ? "" : `,${frac}`)
        : null;
      break;
    case "space_grouped":
      written = grouped
        ? groupInteger(int, space) + (frac === null ? "" : `,${frac}`)
        : null;
      break;
  }

  if (written === null) return null;
  const check = parseRecallNumber(written);
  return check.kind === "ambiguous" ? null : written;
}

/**
 * A canonical value for display: the integer part grouped in threes with ",",
 * and the "." and every fractional digit kept. "1585.70" gives "1,585.70" and
 * "007" stays "007". This is a string operation, so no digit is dropped.
 */
export function formatParsedValue(value: string): string {
  const dot = value.indexOf(".");
  if (dot === -1) return groupInteger(value, ",");
  return `${groupInteger(value.slice(0, dot), ",")}${value.slice(dot)}`;
}
