// The Spread_Rule classifier for persona Sample_Candidates (spec 10 design.md,
// "C5. Sample answers"; requirements C5.2).
//
// A candidate is classified against the Then_Value as the Testify field shows
// it (after any Display_Rescale):
//   near    |candidate - then| <= 5 % of then
//   below   candidate <= 85 % of then (and not near)
//   above   candidate >= 115 % of then (and not near)
//   between anything else
//
// All arithmetic is exact: each decimal string becomes a BigInt on one common
// scale, and the comparisons are integer comparisons. No floats, no rounding.
//
// The rule takes only the candidate and the Then_Value. It does not read a
// Record_Candidate, and it computes with BigInt only, so no float is involved.
//
// Pure module: no DOM, clock, randomness or I/O.

/** Within this many percent of the Then_Value, a candidate is near. */
export const SPREAD_NEAR_PCT = 5;
/** At most this many percent of the Then_Value is below. */
export const SPREAD_BELOW_MAX_PCT = 85;
/** At least this many percent of the Then_Value is above. */
export const SPREAD_ABOVE_MIN_PCT = 115;

export type SpreadClass = "near" | "below" | "above" | "between";

/** A plain non-negative decimal: digits, then an optional dot and digits. */
const PLAIN_DECIMAL = /^[0-9]+(\.[0-9]+)?$/;

/** A decimal as an exact integer and a count of digits after the dot. */
type Scaled = { digits: bigint; scale: number };

function parseScaled(text: string, label: string): Scaled {
  if (!PLAIN_DECIMAL.test(text)) {
    throw new RangeError(
      `${label} must be a plain non-negative decimal, got ${JSON.stringify(text)}`,
    );
  }
  const dot = text.indexOf(".");
  if (dot === -1) {
    return { digits: BigInt(text), scale: 0 };
  }
  const whole = text.slice(0, dot);
  const fraction = text.slice(dot + 1);
  return { digits: BigInt(whole + fraction), scale: fraction.length };
}

/**
 * Put two scaled decimals on one common scale and return their integers. The
 * one with fewer fraction digits is multiplied up, so nothing is rounded.
 */
function onCommonScale(a: Scaled, b: Scaled): [bigint, bigint] {
  const scale = Math.max(a.scale, b.scale);
  const pa = BigInt(10) ** BigInt(scale - a.scale);
  const pb = BigInt(10) ** BigInt(scale - b.scale);
  return [a.digits * pa, b.digits * pb];
}

/**
 * Classify one Sample_Candidate against the Then_Value, both as plain decimal
 * strings in the field's unit. Throws RangeError for a malformed string or a
 * Then_Value that is not positive.
 */
export function classifyCandidate(
  candidate: string,
  thenShown: string,
): SpreadClass {
  const c = parseScaled(candidate, "candidate");
  const t = parseScaled(thenShown, "thenShown");
  if (t.digits === BigInt(0)) {
    throw new RangeError("thenShown must be positive");
  }
  const [cn, tn] = onCommonScale(c, t);
  const distance = cn > tn ? cn - tn : tn - cn;
  const hundred = BigInt(100);

  if (distance * hundred <= BigInt(SPREAD_NEAR_PCT) * tn) return "near";
  if (cn * hundred <= BigInt(SPREAD_BELOW_MAX_PCT) * tn) return "below";
  if (cn * hundred >= BigInt(SPREAD_ABOVE_MIN_PCT) * tn) return "above";
  return "between";
}
