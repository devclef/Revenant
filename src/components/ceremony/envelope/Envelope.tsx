// Feature: 05-reveal-ceremony
//
// Envelope: one inline-SVG envelope drawn in a fixed viewBox, in one of three
// states — `closed` (front, with a postmark), `turned` (back, flap down, the
// WaxSeal on the flap) and `open` (flap up, the letter showing). It is the
// paper object the Ceremony turns over and opens (design.md "Envelope and
// seal", R3.6, R3.7, R8.4).
//
// R3.6 — the envelope is the same for every letter. The SVG, its viewBox, its
// size and every fold are fixed literals here. Nothing in the geometry or the
// markup reads the letter's length, its figures, its metrics or its units. The
// only things that vary between two letters are the three persona date lines
// (which are text the reader must see) and the seal's decorative pattern (keyed
// only by the persona key, inside WaxSeal). A property test renders this at
// many letter lengths and figure counts and asserts the markup is byte-identical
// once the persona list fields are fixed.
//
// R3.7 — the front shows only the persona list dates: "Written as of {date}"
// and "Opens {date}", plus "Prepared later as a demo." when `demo`. It NEVER
// renders a sealed-on date and never claims the letter was sealed on a persona
// date. There is no `sealedAt` prop and nothing here reads one.
//
// R15.1 — every user-facing string comes from `@/components/ceremony/copy`.
// There are no inline copy literals; the date values are filled into the copy
// templates with the UTC-pinned demo date formatters.
//
// This is a pure, presentational component: it holds no state, reads no clock,
// and its markup is identical on the server and the client for a given set of
// props (Property 21). It needs no "use client".

import type { ReactElement } from "react";

import { formatCalendarDate, formatUtcDate } from "@/components/demo/dates";

import { CEREMONY_COPY } from "../copy";
import { WaxSeal } from "./WaxSeal";
import styles from "./Envelope.module.css";

/** The envelope's three states. */
export type EnvelopeState = "closed" | "turned" | "open";

/**
 * The only per-letter inputs the envelope draws: the persona's list fields.
 * None of these is the letter's content, its figures or a sealed-on date.
 */
export type EnvelopePersona = {
  /** Seeds the seal's decorative pattern only (R8.4). */
  key: string;
  /** The written-as-of calendar date, `YYYY-MM-DD` (R3.7). */
  written_as_of: string;
  /** The opening instant, ISO UTC (R3.7). */
  opens_at: string;
  /** Whether this is a demo letter, so the demo note shows (R3.7). */
  demo: boolean;
};

export type EnvelopeProps = {
  /** Which face and fold to draw. */
  state: EnvelopeState;
  /** The persona list fields. Optional, so spec 03 renders show no dates. */
  persona?: EnvelopePersona;
  /** Optional extra class on the root <svg>. */
  className?: string;
};

/**
 * The envelope is drawn in a fixed 300×188 user space (a 1.6 aspect, matching
 * ENVELOPE_TARGET) and scaled to its container by CSS. Every coordinate below
 * is a literal in this space, so the markup never depends on rendered pixels or
 * on anything about the letter.
 */
const VIEW_W = 300;
const VIEW_H = 188;

/** The paper body of the envelope: the same rectangle in every state. */
const BODY_X = 6;
const BODY_Y = 6;
const BODY_W = VIEW_W - 12;
const BODY_H = VIEW_H - 12;

/**
 * The front face: a plain paper rectangle with a postmark ring in the top-right
 * corner. The postmark is decoration only, the same for every letter, and reads
 * nothing. The date text is laid over the paper by HTML in the component, not in
 * the SVG, so it stays selectable and meets AA on the paper surface.
 */
function Front(): ReactElement {
  return (
    <g className={styles.front}>
      <rect
        x={BODY_X}
        y={BODY_Y}
        width={BODY_W}
        height={BODY_H}
        rx={8}
        className={styles.paper}
      />
      {/* Postmark: two concentric rings and three cancel bars, top-right. */}
      <g className={styles.postmark} aria-hidden="true">
        <circle cx={242} cy={44} r={26} />
        <circle cx={242} cy={44} r={20} />
        <line x1={278} y1={34} x2={300} y2={34} />
        <line x1={278} y1={44} x2={300} y2={44} />
        <line x1={278} y1={54} x2={300} y2={54} />
      </g>
    </g>
  );
}

/**
 * The back face: the same body rectangle with the two side folds and the bottom
 * fold drawn as triangles meeting in the middle, and the top flap folded DOWN
 * over them. The WaxSeal sits where the flap tip meets the body. Identical folds
 * for every letter.
 */
function Back(): ReactElement {
  return (
    <g className={styles.back}>
      <rect
        x={BODY_X}
        y={BODY_Y}
        width={BODY_W}
        height={BODY_H}
        rx={8}
        className={styles.paper}
      />
      {/* Left, right and bottom folds meeting at the centre. */}
      <path
        className={styles.fold}
        d={`M${BODY_X} ${BODY_Y} L${VIEW_W / 2} 100 L${BODY_X} ${BODY_Y + BODY_H} Z`}
      />
      <path
        className={styles.fold}
        d={`M${BODY_X + BODY_W} ${BODY_Y} L${VIEW_W / 2} 100 L${BODY_X + BODY_W} ${BODY_Y + BODY_H} Z`}
      />
      <path
        className={styles.fold}
        d={`M${BODY_X} ${BODY_Y + BODY_H} L${VIEW_W / 2} 100 L${BODY_X + BODY_W} ${BODY_Y + BODY_H} Z`}
      />
      {/* The top flap, folded down, a triangle from the two top corners to the
          centre of the body. */}
      <path
        className={styles.flapDown}
        d={`M${BODY_X} ${BODY_Y} L${BODY_X + BODY_W} ${BODY_Y} L${VIEW_W / 2} 104 Z`}
      />
    </g>
  );
}

/**
 * The open face: the same body with the top flap lifted UP, clear of the body,
 * and a plain letter sheet sliding out of the top. The flap keeps the WaxSeal on
 * it (now broken in the Ceremony's seal stage, but Envelope itself just places
 * the seal; cracks are the seal/ task's overlay). Identical for every letter.
 */
function Open(): ReactElement {
  return (
    <g className={styles.open}>
      <rect
        x={BODY_X}
        y={BODY_Y}
        width={BODY_W}
        height={BODY_H}
        rx={8}
        className={styles.paper}
      />
      {/* The letter sheet, peeking above the body's top edge. One fixed sheet
          for every letter: it carries no text here (the text lives in the
          letter stage), only the shape. */}
      <rect
        x={BODY_X + 26}
        y={BODY_Y - 34}
        width={BODY_W - 52}
        height={BODY_H}
        rx={6}
        className={styles.sheet}
      />
      {/* The body front edge, drawn over the sheet so the sheet reads as inside. */}
      <path
        className={styles.pocket}
        d={`M${BODY_X} ${BODY_Y + 40} L${VIEW_W / 2} 118 L${BODY_X + BODY_W} ${BODY_Y + 40} L${BODY_X + BODY_W} ${BODY_Y + BODY_H} L${BODY_X} ${BODY_Y + BODY_H} Z`}
      />
      {/* The flap lifted up, above the body. */}
      <path
        className={styles.flapUp}
        d={`M${BODY_X} ${BODY_Y} L${BODY_X + BODY_W} ${BODY_Y} L${VIEW_W / 2} ${BODY_Y - 44} Z`}
      />
    </g>
  );
}

/** The seal's resting place on the flap, in viewBox units. */
const SEAL_SIZE = 64;
const SEAL_X = VIEW_W / 2 - SEAL_SIZE / 2;
/** On the turned (flap-down) state the seal sits at the flap tip (~y 104). */
const SEAL_Y_TURNED = 104 - SEAL_SIZE / 2;
/** On the open state the flap is up; the seal rides with it near the top. */
const SEAL_Y_OPEN = BODY_Y - 44 + 8;

/**
 * The envelope.
 *
 * `closed` draws the front with its postmark; `turned` the back with the flap
 * folded down and the WaxSeal on it; `open` the body with the flap lifted and
 * the letter sheet showing. The date lines sit over the front as HTML text and
 * only appear on `closed`, because they belong to the face a reader reads first.
 */
export function Envelope({
  state,
  persona,
  className,
}: EnvelopeProps): ReactElement {
  const rootClass = [styles.envelope, className].filter(Boolean).join(" ");

  // Date lines come straight from the persona list fields through the copy
  // templates. No sealed-on date is ever shown (R3.7).
  const writtenAsOf =
    persona === undefined
      ? undefined
      : CEREMONY_COPY.envelopeWrittenAsOf.replace(
          "{date}",
          formatCalendarDate(persona.written_as_of),
        );
  const opens =
    persona === undefined
      ? undefined
      : CEREMONY_COPY.envelopeOpens.replace(
          "{date}",
          formatUtcDate(persona.opens_at),
        );
  const demoNote =
    persona !== undefined && persona.demo
      ? CEREMONY_COPY.envelopeDemoNote
      : undefined;

  // The seal's pattern key: the persona key when present, else a fixed default
  // so spec 03 renders (no persona) still draw a stable seal (R8.4).
  const patternKey = persona?.key ?? "revenant-default-seal";

  return (
    <div className={rootClass} data-envelope-state={state}>
      <svg
        className={styles.art}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-label="An envelope."
        focusable="false"
        preserveAspectRatio="xMidYMid meet"
      >
        {state === "closed" ? <Front /> : null}
        {state === "turned" ? <Back /> : null}
        {state === "open" ? <Open /> : null}

        {/* The wax seal rides on the flap for turned and open. The front has no
            seal: it is the face shown to the world. */}
        {state === "turned" || state === "open" ? (
          <g
            transform={`translate(${SEAL_X} ${
              state === "open" ? SEAL_Y_OPEN : SEAL_Y_TURNED
            })`}
          >
            <WaxSeal patternKey={patternKey} size={SEAL_SIZE} />
          </g>
        ) : null}
      </svg>

      {/* The date lines, as selectable HTML text over the front. They show only
          on the closed front (R3.7), and never a sealed-on date. */}
      {state === "closed" && persona !== undefined ? (
        <div className={styles.lines}>
          <p className={styles.line}>{writtenAsOf}</p>
          <p className={styles.line}>{opens}</p>
          {demoNote === undefined ? null : (
            <p className={styles.demoNote}>{demoNote}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
