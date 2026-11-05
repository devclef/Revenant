// Feature: 05-reveal-ceremony
//
// Envelope: one inline-SVG envelope with a front and a back face, drawn in a
// fixed viewBox. `closed` shows the front (with a postmark), `turned` turns the
// back to the reader (flap down, the one WaxSeal on the flap) and `open` shows
// the flap lifted with the letter. It is the paper object the Ceremony turns
// over and opens (design.md "The Envelope", R3.6, R3.7, R10.8).
//
// R3.6 — the envelope is the same for every letter. The SVG, its viewBox, its
// size and every fold are fixed literals here. Nothing in the geometry or the
// markup reads the letter's length, its figures, its metrics or its units. The
// only thing that varies between two letters is the persona date lines (text
// the reader must see). The wax seal is one fixed design for every letter
// (R10.10). A property test renders this at many letter lengths and figure
// counts and asserts the markup is byte-identical once the persona list fields
// are fixed.
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

import type { CSSProperties, ReactElement } from "react";

import { formatCalendarDate, formatLetterDate } from "@/components/ui/letter-date";

import { CEREMONY_COPY } from "../copy";
import { ENVELOPE_TURN_AT_MS, ENVELOPE_TURN_MS } from "../constants";
import { WaxSeal } from "./WaxSeal";
import styles from "./Envelope.module.css";

/** The envelope's three states. */
export type EnvelopeState = "closed" | "turned" | "open";

/**
 * The only per-letter inputs the envelope draws: the persona's list fields.
 * None of these is the letter's content, its figures or a sealed-on date.
 */
export type EnvelopePersona = {
  /** The persona key. Not drawn: the wax seal is the same for every letter (R10.10). */
  key: string;
  /** The written-as-of calendar date, `YYYY-MM-DD` (R3.7). */
  written_as_of: string;
  /** The opening instant, ISO UTC (R3.7). */
  opens_at: string;
  /** Whether this is a demo letter, so the demo note shows (R3.7). */
  demo: boolean;
};

/**
 * The front's layout (spec 07 task 4). `wide` shows the written-as-of and
 * opening lines and the demo note. `narrow` shows only the two date lines, each
 * on its own line. `responsive` shows the wide content and lets CSS hide the
 * demo note at small widths.
 */
export type EnvelopeLayout = "narrow" | "wide" | "responsive";

export type EnvelopeProps = {
  /** Which face and fold to draw. */
  state: EnvelopeState;
  /** The front's layout. Defaults to `responsive`. */
  layout?: EnvelopeLayout;
  /** The persona list fields. Optional, so spec 03 renders show no dates. */
  persona?: EnvelopePersona;
  /** Optional extra class on the root <svg>. */
  className?: string;
};

/**
 * The envelope is drawn in a fixed 300×188 user space (a 1.6 aspect, matching
 * the resting geometry in EnvelopeView) and scaled to its container by CSS. Every coordinate below
 * is a literal in this space, so the markup never depends on rendered pixels or
 * on anything about the letter.
 */
const VIEW_W = 300;
const VIEW_H = 188;

/** The top of the dirt band: the bottom 22 percent of the envelope. */
const DIRT_TOP = VIEW_H * 0.78;

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

/**
 * The torn bottom edge: a zigzag along the bottom of the body, drawn over the
 * body in every state. Identical for every letter.
 */
function TornEdge(): ReactElement {
  const y = BODY_Y + BODY_H;
  const steps = 12;
  const stepW = BODY_W / steps;
  let d = `M${BODY_X} ${y}`;
  for (let i = 0; i < steps; i += 1) {
    const x = BODY_X + stepW * (i + 0.5);
    const depth = i % 2 === 0 ? 4 : 1.5;
    d += ` L${x.toFixed(2)} ${(y - depth).toFixed(2)}`;
    d += ` L${(BODY_X + stepW * (i + 1)).toFixed(2)} ${y}`;
  }
  return <path className={styles.tear} d={d} aria-hidden="true" />;
}

/**
 * The dirt in the bottom 22 percent of the envelope. Flecks sit at fixed
 * positions, so they are the same on every letter. Front text sits above this
 * band.
 */
const DIRT_FLECKS: ReadonlyArray<readonly [number, number, number]> = [
  [22, 166, 3.2],
  [48, 178, 2.4],
  [74, 160, 2.8],
  [101, 176, 3.6],
  [133, 163, 2.2],
  [160, 179, 3.0],
  [188, 167, 2.6],
  [215, 177, 3.4],
  [243, 162, 2.4],
  [270, 174, 3.0],
  [36, 150, 1.8],
  [118, 152, 1.6],
  [200, 150, 1.9],
];

function Dirt(): ReactElement {
  return (
    <g className={styles.dirt} aria-hidden="true">
      <rect
        x={0}
        y={DIRT_TOP}
        width={VIEW_W}
        height={VIEW_H - DIRT_TOP}
        className={styles.dirtBand}
      />
      {DIRT_FLECKS.map(([cx, cy, r]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
      ))}
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
 * The envelope has a front face and a back face in one turning object. `closed`
 * shows the front with its postmark; `turned` turns the back to the reader with
 * the flap down and the WaxSeal on it; `open` shows the flap lifted and the
 * letter sheet. The turn is CSS, timed from the constants (R10.8). The date
 * lines sit over the front as HTML text and only appear on `closed`, because
 * they belong to the face a reader reads first.
 */
export function Envelope({
  state,
  layout = "responsive",
  persona,
  className,
}: EnvelopeProps): ReactElement {
  const rootClass = [
    styles.envelope,
    layout === "narrow" ? styles.narrow : styles.wide,
    className,
  ]
    .filter(Boolean)
    .join(" ");

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
          formatLetterDate(persona.opens_at, { kind: "utc" }),
        );
  const demoNote =
    persona !== undefined && persona.demo
      ? CEREMONY_COPY.envelopeDemoNote
      : undefined;

  // The seal is the same for every letter (R10.10), so nothing here reads the
  // persona beyond its date lines.
  const turning = state !== "closed";
  const turnerClass = [
    styles.turner,
    turning ? styles.turned : undefined,
    turning ? styles.turning : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  // The turn starts at ENVELOPE_TURN_AT_MS and lasts ENVELOPE_TURN_MS, ending
  // by 920 ms (R10.8). Calm and reduced motion drop the animation in CSS and
  // keep the end pose, so the back shows in the same render (R10.9).
  const turnStyle: CSSProperties | undefined = turning
    ? {
        animationDelay: `${ENVELOPE_TURN_AT_MS}ms`,
        animationDuration: `${ENVELOPE_TURN_MS}ms`,
      }
    : undefined;

  return (
    <div
      className={rootClass}
      data-envelope-state={state}
      data-envelope-layout={layout}
    >
      <div className={turnerClass} style={turnStyle} data-envelope-turner>
        {/* The front face: the postmark and the torn edge. It holds no seal. */}
        <svg
          className={`${styles.art} ${styles.faceFront}`}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          aria-hidden="true"
          focusable="false"
          preserveAspectRatio="xMidYMid meet"
        >
          <Front />
          <TornEdge />
          <Dirt />
        </svg>

        {/* The back face: the pocket, the flap and the one wax seal. It is
            turned to the reader from `recall` on (R10.8). */}
        <svg
          className={`${styles.art} ${styles.faceBack}`}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          aria-hidden="true"
          focusable="false"
          preserveAspectRatio="xMidYMid meet"
        >
          {state === "open" ? <Open /> : <Back />}
          <TornEdge />
          <Dirt />
          <g
            transform={`translate(${SEAL_X} ${
              state === "open" ? SEAL_Y_OPEN : SEAL_Y_TURNED
            })`}
          >
            <WaxSeal size={SEAL_SIZE} />
          </g>
        </svg>
      </div>

      {/* The date lines, as selectable HTML text over the front. They show only
          on the closed front (R3.7), and never a sealed-on date. */}
      {state === "closed" && persona !== undefined ? (
        <div className={styles.lines}>
          <p className={`${styles.line} ${styles.date}`} data-date>
            {writtenAsOf}
          </p>
          <p className={`${styles.line} ${styles.date}`} data-date>
            {opens}
          </p>
          {demoNote === undefined || layout === "narrow" ? null : (
            <p className={styles.demoNote} data-demo-note>
              {demoNote}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
