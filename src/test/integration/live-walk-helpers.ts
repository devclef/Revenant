/**
 * Pure helpers for the Live_Walk (spec 12, Q1 and Q2). No browser and no network.
 * The persona date checks (spec 18) import the letter-date formatters only. The
 * walk replay in `live-walk.test.ts` uses them to name Step_Shots,
 * list the expected set, report missing shots, count Motion_Controls, look for
 * placeholder figures in the final reveal, and record each step's result.
 */

import {
  formatCalendarDate,
  formatCalendarMonth,
  formatLetterDate,
  letterZoneFor,
} from "@/components/ui/letter-date";

/**
 * The nineteen steps of the walk, in order. `<step>` in a Step_Shot name is one of these.
 * The `write-*` steps cover the desk (occasion, receipt, failed receipt). The `seal-*`
 * steps wrap the backup choice on the Seal step, and `press-held` and `setting` come
 * after them. `persona-read` and `tamper` are the persona runs on the Read step, so
 * they follow the live walk; `tamper` is last.
 */
export const WALK_STEP_NAMES = [
  "write",
  "write-occasion",
  "write-receipt",
  "write-failed",
  "write-receipts",
  "seal",
  "seal-before-choice",
  "seal-after-choice",
  "press-held",
  "setting",
  "wait",
  "open-letter",
  "remember",
  "marks",
  "letter",
  "figures",
  "close",
  "persona-read",
  "tamper",
] as const;

export type WalkStepName = (typeof WALK_STEP_NAMES)[number];

/** The app the Live_Walk and the Press_Test drive: a local production build. */
export const WALK_BASE_URL = "http://localhost:3000";

/** The two widths every Step_Shot is taken at (Q2.1). */
export const WALK_SIZES = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
] as const;

/** The two walk variants (Q1.3). */
export const WALK_VARIANTS = ["one-figure", "no-figure"] as const;

export type WalkVariant = (typeof WALK_VARIANTS)[number];

/**
 * Steps that produce a Step_Shot in each variant. Both variants reach every
 * step: the no-figure letter still goes through the figures stage, where the
 * Nothing_To_Compare_Line is shown, and it ends on the 0-figure close (Q2.3).
 * Filenames carry no variant, so both variants expect the same names.
 */
export const EXPECTED_STEPS: Record<WalkVariant, readonly WalkStepName[]> = {
  "one-figure": WALK_STEP_NAMES,
  "no-figure": WALK_STEP_NAMES,
};

/** The CSS selector for the Motion_Control (Q1, Motion_Control count check). */
export const MOTION_CONTROL_SELECTOR = 'button[aria-label*="motion" i]';

/** Build one Step_Shot file name: `live-<nn>-<step>-<w>x<h>[-reduced].png`. */
export function stepShotName(input: {
  step: string;
  width: number;
  height: number;
  reduced?: boolean;
}): string {
  const index = WALK_STEP_NAMES.indexOf(input.step as WalkStepName);
  if (index === -1) {
    throw new Error(`Unknown walk step: ${input.step}`);
  }
  const nn = String(index + 1).padStart(2, "0");
  const suffix = input.reduced ? "-reduced" : "";
  return `live-${nn}-${input.step}-${input.width}x${input.height}${suffix}.png`;
}

/**
 * Every Step_Shot name a variant must produce: each expected step, at both
 * widths, once without and once with `prefers-reduced-motion: reduce`.
 */
export function expectedShotNames(variant: WalkVariant): string[] {
  const names: string[] = [];
  for (const reduced of [false, true]) {
    for (const size of WALK_SIZES) {
      for (const step of EXPECTED_STEPS[variant]) {
        names.push(
          stepShotName({
            step,
            width: size.width,
            height: size.height,
            reduced,
          }),
        );
      }
    }
  }
  return names;
}

/**
 * Compare the expected Step_Shot names with the files that exist. Returns one
 * `FAIL missing Step_Shot <name>` line per missing file, or a single PASS line.
 */
export function reportMissingShots(
  expected: readonly string[],
  present: readonly string[],
): { missing: string[]; lines: string[] } {
  const presentSet = new Set(present);
  const missing = expected.filter((name) => !presentSet.has(name));
  if (missing.length === 0) {
    return {
      missing,
      lines: [`PASS all ${expected.length} Step_Shots present`],
    };
  }
  return {
    missing,
    lines: missing.map((name) => `FAIL missing Step_Shot ${name}`),
  };
}

/**
 * Check the Motion_Control count. The spec needs exactly one (Q1.6 and the
 * Motion_Control acceptance criteria), so any other count fails.
 */
export function checkMotionControlCount(count: number): {
  ok: boolean;
  message: string;
} {
  if (count === 1) {
    return { ok: true, message: "PASS Motion_Control count 1" };
  }
  return {
    ok: false,
    message: `FAIL Motion_Control count ${count}, expected 1 (${MOTION_CONTROL_SELECTOR})`,
  };
}

const PLACEHOLDER_PATTERNS: readonly { term: string; pattern: RegExp }[] = [
  // "0.000" and "0.0%" must stand alone: "10.0%" or "0.0001" are real values.
  { term: "0.000", pattern: /(?<![\d.])0\.000(?!\d)/ },
  { term: "0.0%", pattern: /(?<![\d.])0\.0%/ },
  { term: "unchanged", pattern: /\bunchanged\b/i },
];

/**
 * Return the placeholder strings found in the final reveal text: "0.000",
 * "0.0%" and "unchanged". An empty array means none were found.
 */
export function findPlaceholderFigures(text: string): string[] {
  return PLACEHOLDER_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(
    ({ term }) => term,
  );
}

/** One defect found at a step. Every field is required so the findings are complete. */
export type WalkDefect = {
  step: WalkStepName;
  expected: string;
  observed: string;
  suspectedFile: string;
};

/** The result of one step of the walk (Q1.5). */
export type WalkStepResult = {
  step: WalkStepName;
  pass: boolean;
  observation: string;
  shots: string[];
  defects: WalkDefect[];
};

/**
 * Build the result record for one step. A step passes when it has no defects.
 * Throws on an unknown step name so a typo cannot reach the findings block.
 */
export function recordStepResult(input: {
  step: string;
  observation: string;
  shots: string[];
  defects: WalkDefect[];
}): WalkStepResult {
  const step = input.step as WalkStepName;
  if (!WALK_STEP_NAMES.includes(step)) {
    throw new Error(`Unknown walk step: ${input.step}`);
  }
  return {
    step,
    pass: input.defects.length === 0,
    observation: input.observation,
    shots: [...input.shots],
    defects: input.defects.map((defect) => ({ ...defect })),
  };
}

/* ---------------------------------------------------------------------------
 * Break the seal through Close (Q1.2, Q1.6, Q2.1 to Q2.6).
 * The browser collects raw values per step; the functions below decide.
 * ------------------------------------------------------------------------- */

/** The three ways the seal can be broken (Q1.2): press and hold, the Seal_Button, the Skip_Link. */
export const BREAK_METHODS = ["hold", "button", "skip"] as const;

export type BreakMethod = (typeof BREAK_METHODS)[number];

/** The phone width. The walk presses the seal with touch here, and with the mouse at the desktop width. */
export const PHONE_WIDTH = 390;

/** How the Seal step's press is driven: a mouse hold, a touch hold, one click, or the Space key. */
export type SealPressInput = "hold" | "touch" | "click" | "keyboard";

/**
 * Picks how the walk presses the seal (Q1.3). Reduced motion has no hold, so one
 * click runs the press. The keyboard run presses Space on the focused control.
 * Otherwise a phone width uses touch and every other width holds with the mouse.
 */
export function sealPressInput(run: {
  width: number;
  reduced: boolean;
  keyboard: boolean;
}): SealPressInput {
  if (run.keyboard) return "keyboard";
  if (run.reduced) return "click";
  return run.width === PHONE_WIDTH ? "touch" : "hold";
}

/**
 * The Step_Shot name for a step, with a suffix for the non-default break methods
 * (`-via-button`, `-via-skip`). The default `hold` method keeps the exact name the
 * spec gives (Q2.1), so only one run per width writes the canonical file.
 */
export function walkShotName(input: {
  step: string;
  width: number;
  height: number;
  reduced?: boolean;
  method?: BreakMethod;
}): string {
  const base = stepShotName(input);
  if (!input.method || input.method === "hold") return base;
  return base.replace(/\.png$/, `-via-${input.method}.png`);
}

/** Steps whose Step_Shot is the full page, not only the First_Viewport (Q2.2). */
export const FULL_PAGE_STEPS: ReadonlySet<WalkStepName> = new Set<WalkStepName>(
  ["letter", "figures", "close"],
);

/**
 * The Step_Indicator item that must be current at each step (Q1.6, spec 12 table
 * row 07). These patterns follow the ceremony copy: "Break the seal" for `marks`,
 * "Receipts" from `letter` on (spec 16, Requirement 2.1; "See the receipts" is
 * now only the Read step's button). Steps not listed here are not checked.
 */
export const STEP_INDICATOR_EXPECTATIONS: Partial<
  Record<WalkStepName, RegExp>
> = {
  marks: /^break the seal$/i,
  letter: /^receipts$/i,
  figures: /^receipts$/i,
  close: /^receipts$/i,
};

/** The file a defect at each step most likely lives in. The owner confirms before fixing. */
export const STEP_SUSPECTED_FILES: Record<WalkStepName, string> = {
  write: "src/components/live/WriteForm.tsx",
  "write-occasion": "src/components/live/desk/OccasionPills.tsx",
  "write-receipt": "src/components/live/desk/ReceiptPanel.tsx",
  "write-failed": "src/components/live/desk/QuestionSection.tsx",
  "write-receipts": "src/components/live/FigurePicker.tsx",
  seal: "src/components/live/SealPage.tsx",
  "seal-before-choice": "src/components/live/seal-step/SealStep.tsx",
  "seal-after-choice": "src/components/live/seal-step/SealStep.tsx",
  "press-held": "src/components/live/press/PressEnvelope.tsx",
  setting: "src/components/live/press/PressEnvelope.tsx",
  wait: "src/components/live/SealPage.tsx",
  "open-letter": "src/components/live/stepper/LiveWaitStep.tsx",
  remember: "src/components/ceremony/recall/RecallPager.tsx",
  marks: "src/components/ceremony/seal/SealBreak.tsx",
  letter: "src/components/ceremony/letter/",
  figures: "src/components/ceremony/figures/",
  close: "src/components/ceremony/close/",
  "persona-read": "src/components/reveal/ReceiptCard.tsx",
  tamper: "src/components/reveal/tamper/TamperControl.tsx",
};

/** One check's outcome. `expected` says what had to hold, so a defect can quote it. */
export type StepCheck = {
  ok: boolean;
  expected: string;
  message: string;
};

export type RgbaColor = { r: number; g: number; b: number; a: number };

/**
 * Parse a computed CSS colour (`rgb(...)` or `rgba(...)`, as `getComputedStyle`
 * returns it). Returns null for anything else, so the caller can say it could not be measured.
 */
export function parseCssColor(input: string): RgbaColor | null {
  const match = input
    .trim()
    .match(
      /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+)(%?))?\s*\)$/,
    );
  if (!match) return null;
  const [r, g, b] = [match[1], match[2], match[3]].map(Number);
  const a =
    match[4] === undefined ? 1 : Number(match[4]) / (match[5] ? 100 : 1);
  if ([r, g, b, a].some((value) => Number.isNaN(value))) return null;
  return { r, g, b, a };
}

/** Put a translucent foreground over an opaque background, the way the screen paints it. */
export function compositeOver(fg: RgbaColor, bg: RgbaColor): RgbaColor {
  const mix = (f: number, b: number) => f * fg.a + b * (1 - fg.a);
  return {
    r: mix(fg.r, bg.r),
    g: mix(fg.g, bg.g),
    b: mix(fg.b, bg.b),
    a: 1,
  };
}

/** WCAG 2.x relative luminance of an opaque colour. */
export function relativeLuminance(color: RgbaColor): number {
  const linear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * linear(color.r) +
    0.7152 * linear(color.g) +
    0.0722 * linear(color.b)
  );
}

/** WCAG contrast ratio between two opaque colours, from 1 to 21. */
export function contrastRatio(a: RgbaColor, b: RgbaColor): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * The G1.8 floor for a text run: 4.5:1 for body text, 3:1 for large text
 * (24 px or more, or 18.66 px or more and bold, per WCAG 2.2).
 */
export function contrastFloor(input: {
  fontSizePx: number;
  fontWeight: number;
}): number {
  const large =
    input.fontSizePx >= 24 ||
    (input.fontSizePx >= 18.66 && input.fontWeight >= 700);
  return large ? 3 : 4.5;
}

/** One text run as the browser reports it. `bg` is null when no opaque background colour was found. */
export type ContrastSample = {
  text: string;
  fg: string;
  bg: string | null;
  fontSizePx: number;
  fontWeight: number;
};

/**
 * Check one text run against its floor. A run with no measurable colours is
 * reported as unmeasured, not as a pass and not as a fail.
 */
export function checkContrast(sample: ContrastSample): {
  measured: boolean;
  ok: boolean;
  ratio: number | null;
  message: string;
} {
  const floor = contrastFloor(sample);
  const fg = parseCssColor(sample.fg);
  const bg = sample.bg === null ? null : parseCssColor(sample.bg);
  if (!fg || !bg) {
    return {
      measured: false,
      ok: true,
      ratio: null,
      message: `UNMEASURED "${sample.text}": colours could not be read (${sample.fg} on ${sample.bg ?? "no opaque background"})`,
    };
  }
  const ratio = contrastRatio(compositeOver(fg, bg), bg);
  const ok = ratio >= floor;
  return {
    measured: true,
    ok,
    ratio,
    message: `${ok ? "PASS" : "FAIL"} "${sample.text}" ${ratio.toFixed(2)}:1, floor ${floor}:1`,
  };
}

/**
 * The page facts one step's checks read. Filled in by the browser, then judged here.
 * `motionControls` is the count of MOTION_CONTROL_SELECTOR matches.
 */
export type PageSnapshot = {
  scrollWidth: number;
  clientWidth: number;
  /** Elements whose overflow is not visible and that hold text. The check decides which are clipped. */
  clipCandidates: ClippedSample[];
  contrastSamples: ContrastSample[];
  /** The text of the current Step_Indicator item (`aria-current="step"`), or null. */
  currentStep: string | null;
  /** Every step name in the first visible [data-step-track], in order, or null with none. */
  trackNames?: string[] | null;
  /** The track's phone line ("Step {n} of {total} · {label}") when it is shown, else null. */
  trackPhone?: string | null;
  bodyText: string;
  motionControls: number;
  /** Console and page errors raised since the previous step. */
  consoleErrors: string[];
};

export type ClippedSample = {
  tag: string;
  text: string;
  scrollWidth: number;
  clientWidth: number;
  overflowX: string;
  /** The element's `class` attribute. CSS module names keep their local name, e.g. `live_visuallyHidden__x`. */
  className: string;
};

/** Horizontal scroll on the document (Q1.6). One pixel of subpixel rounding is allowed. */
export function checkHorizontalScroll(
  scrollWidth: number,
  clientWidth: number,
): StepCheck {
  const expected = "no horizontal scroll on the document";
  if (scrollWidth <= clientWidth + 1) {
    return {
      ok: true,
      expected,
      message: `PASS ${expected} (${scrollWidth} <= ${clientWidth})`,
    };
  }
  return {
    ok: false,
    expected,
    message: `FAIL horizontal scroll: scrollWidth ${scrollWidth} is wider than clientWidth ${clientWidth}`,
  };
}

/**
 * Classes that hide text on purpose: the `.visuallyHidden` class (live.module.css)
 * and the stepper module's classes (stepper.module.css, e.g. `.name` for steps not
 * yet reached and `.announce` for the live announcer). Both use a 1px box with
 * `clip: rect(0 0 0 0)`, so their text is not visible to the reader by design.
 */
const HIDDEN_BY_DESIGN_CLASS = /visuallyHidden|stepper/i;

function isHiddenByDesign(className: string): boolean {
  return className
    .split(/\s+/)
    .some((token) => HIDDEN_BY_DESIGN_CLASS.test(token));
}

/**
 * Text clipped by its container (Q1.6): a container with overflow not visible
 * whose content is wider than its box, by more than one pixel.
 *
 * Only containers that carry a `.visuallyHidden` or stepper class are exempt,
 * because their 1px box hides text on purpose. Any other container, including
 * one only 1px wide, that clips its text is reported.
 */
export function checkClippedText(samples: readonly ClippedSample[]): StepCheck {
  const expected = "no text clipped by its container";
  const clipped = samples.filter(
    (s) =>
      s.overflowX !== "visible" &&
      !(isHiddenByDesign(s.className) && s.clientWidth <= 1) &&
      s.scrollWidth > s.clientWidth + 1,
  );
  if (clipped.length === 0) {
    return { ok: true, expected, message: `PASS ${expected}` };
  }
  const first = clipped
    .slice(0, 3)
    .map((s) => `<${s.tag}> "${s.text}" (${s.scrollWidth} > ${s.clientWidth})`)
    .join("; ");
  return {
    ok: false,
    expected,
    message: `FAIL ${clipped.length} clipped container(s): ${first}`,
  };
}

/** Motion_Control count at a step (Q1.6). Wraps `checkMotionControlCount` in the StepCheck shape. */
export function checkMotionControlStep(count: number): StepCheck {
  const result = checkMotionControlCount(count);
  return {
    ok: result.ok,
    expected: "exactly one Motion_Control",
    message: result.message,
  };
}

/** The Step_Indicator's current item must match the step (Q1.6). */
export function checkStepIndicator(
  current: string | null,
  expected: RegExp,
): StepCheck {
  const label = `current Step_Indicator item matches ${expected}`;
  if (current !== null && expected.test(current.trim())) {
    return {
      ok: true,
      expected: label,
      message: `PASS current item "${current}"`,
    };
  }
  return {
    ok: false,
    expected: label,
    message: `FAIL current Step_Indicator item is ${current === null ? "missing" : `"${current}"`}`,
  };
}

/** Forbidden strings in the final reveal (Q1.6): "0.000", "0.0%" and "unchanged". */
export function checkForbiddenFinalText(text: string): StepCheck {
  const expected = 'none of "0.000", "0.0%", "unchanged" in the final reveal';
  const found = findPlaceholderFigures(text);
  if (found.length === 0) {
    return { ok: true, expected, message: `PASS ${expected}` };
  }
  return {
    ok: false,
    expected,
    message: `FAIL found ${found.map((term) => `"${term}"`).join(", ")} in the final reveal`,
  };
}

/** Any console or page error fails the step (Q1.6). */
export function checkConsoleErrors(messages: readonly string[]): StepCheck {
  const expected = "no console error";
  if (messages.length === 0) {
    return { ok: true, expected, message: `PASS ${expected}` };
  }
  return {
    ok: false,
    expected,
    message: `FAIL ${messages.length} console error(s): ${messages.slice(0, 3).join(" | ")}`,
  };
}

/**
 * Run every Q1.6 check that applies at one step, and return one StepCheck each.
 * Contrast is one check: it fails if any measured run is below its floor, and
 * lists how many runs could not be measured.
 */
export function checkStepSnapshot(
  step: WalkStepName,
  snapshot: PageSnapshot,
  options: { letterText?: string; track?: readonly string[] } = {},
): StepCheck[] {
  const checks: StepCheck[] = [
    checkHorizontalScroll(snapshot.scrollWidth, snapshot.clientWidth),
    checkClippedText(snapshot.clipCandidates),
    checkMotionControlStep(snapshot.motionControls),
  ];

  const indicator = STEP_INDICATOR_EXPECTATIONS[step];
  if (indicator) {
    checks.push(checkStepIndicator(snapshot.currentStep, indicator));
  }

  if (options.track !== undefined && snapshot.trackNames !== undefined) {
    checks.push(
      checkTrackNames(
        snapshot.trackNames,
        snapshot.trackPhone ?? null,
        options.track,
      ),
    );
  }

  // A run that could not be measured is a defect here, not a pass: the walk
  // cannot show the contrast floor was met for that text.
  const contrast = snapshot.contrastSamples.map(checkContrast);
  const failing = contrast.filter((c) => !c.measured || !c.ok);
  const unmeasured = contrast.filter((c) => !c.measured).length;
  checks.push({
    ok: failing.length === 0,
    expected:
      "every text run is measured and meets the G1.8 contrast floor on its background",
    message:
      failing.length === 0
        ? `PASS contrast on ${contrast.length} measured text run(s), 0 unmeasured`
        : `FAIL ${failing.length} text run(s) not verified against the G1.8 floor (${unmeasured} unmeasured): ${failing
            .slice(0, 3)
            .map((c) => c.message)
            .join("; ")}`,
  });

  if (step === "figures" || step === "close") {
    checks.push(checkForbiddenFinalText(snapshot.bodyText));
  }

  if (step === "letter" && options.letterText !== undefined) {
    const present = snapshot.bodyText.includes(options.letterText);
    checks.push({
      ok: present,
      expected: "the typed letter text is shown in full",
      message: present
        ? "PASS the typed letter text is shown"
        : "FAIL the typed letter text is not shown on the letter stage",
    });
  }

  checks.push(checkConsoleErrors(snapshot.consoleErrors));
  return checks;
}

/** Turn the failing checks of one step into defects, with the suspected file. */
export function defectsFromChecks(
  step: WalkStepName,
  checks: readonly StepCheck[],
): WalkDefect[] {
  return checks
    .filter((check) => !check.ok)
    .map((check) => ({
      step,
      expected: check.expected,
      observed: check.message,
      suspectedFile: STEP_SUSPECTED_FILES[step],
    }));
}

/* ---------------------------------------------------------------------------
 * Per-run checks used by live-walk.test.ts (Q1, Q2).
 * ------------------------------------------------------------------------- */

/**
 * The missing-Step_Shot check for one browser run. The walk calls it right
 * after that run, before the next run can overwrite the same file names in
 * `qa-shots/live-walk/`, so a FAIL always belongs to the run that produced it.
 */
export function checkRunShots(
  expected: readonly string[],
  present: readonly string[],
): { ok: boolean; missing: string[]; lines: string[] } {
  const report = reportMissingShots(expected, present);
  return { ok: report.missing.length === 0, ...report };
}

/** One file in `qa-shots/live-walk/` and when it was last written, in ms since the epoch. */
export type ShotFile = { name: string; mtimeMs: number };

/**
 * The names of the files this run wrote: mtime at or after the run start. A
 * file left by an earlier run, including the other variant's run, does not
 * count, so a stale shot can never satisfy the check.
 */
export function shotsWrittenSince(
  files: readonly ShotFile[],
  runStartMs: number,
): string[] {
  return files
    .filter((file) => file.mtimeMs >= runStartMs)
    .map((file) => file.name);
}

/** The stage whose Skip_Link stays up by design, so the settle wait ignores it. */
export const SKIP_LINK_STAGE = "marks";

/**
 * Whether the settle wait must keep waiting because the Skip_Link is still up.
 * The wait covers every stage except `marks`, where the link stays visible.
 */
export function skipLinkBlocksSettle(
  stage: string,
  skipLinkVisible: boolean,
): boolean {
  return skipLinkVisible && stage !== SKIP_LINK_STAGE;
}

/**
 * The own-number blank check (Q1.2 receipts step). `values` are the text of
 * every own-number input inside the open Receipts_Disclosure. A walk with no
 * figure adds no own-number row, so zero inputs is the normal state. The
 * message reports the count it saw and never claims rows it did not find.
 */
export function checkOwnNumberRowsBlank(
  values: readonly string[],
): StepCheck & {
  count: number;
} {
  const expected = "every own-number row input inside the disclosure is empty";
  const filled = values.filter((value) => value.trim() !== "").length;
  if (filled > 0) {
    return {
      ok: false,
      expected,
      count: values.length,
      message: `FAIL ${filled} own-number row input(s) hold text, so the rows are not blank`,
    };
  }
  if (values.length === 0) {
    return {
      ok: true,
      expected,
      count: 0,
      message: "PASS no own-number rows added",
    };
  }
  return {
    ok: true,
    expected,
    count: values.length,
    message: `PASS own-number rows blank (${values.length} input(s), all empty)`,
  };
}

/** Where the settle wait stands: the last state seen and when it first appeared. */
export type SettleState = { last: string; since: number };

/**
 * One poll of the stable-wait condition (see `waitForStable` in
 * live-walk.test.ts). `state` is the Stage name and the count of finite running
 * animations. The screen is settled once that state has not changed for
 * `settleMs`. A change restarts the clock and is never settled on the same poll.
 */
export function advanceSettle(
  prev: SettleState,
  state: string,
  now: number,
  settleMs: number,
): { next: SettleState; settled: boolean } {
  if (state !== prev.last) {
    return { next: { last: state, since: now }, settled: false };
  }
  return { next: prev, settled: now - prev.since >= settleMs };
}

/**
 * A step with no saved Step_Shot fails (Q2.6, Q2.7): the walk never claims a
 * step passed without its shot. Returns the defect, or null when the shot exists.
 */
export function missingShotDefect(input: {
  step: WalkStepName;
  shot: string | undefined;
  expectedName: string;
  suspectedFile: string;
}): WalkDefect | null {
  if (input.shot !== undefined) return null;
  return {
    step: input.step,
    expected: `A Step_Shot named ${input.expectedName} is saved for this step.`,
    observed: "No Step_Shot was saved for this step.",
    suspectedFile: input.suspectedFile,
  };
}

/** The prefix of each Step_Shot line in the run record. */
export const RECORD_SHOT_PREFIX = "Shot: qa-shots/live-walk/";

/**
 * The expected Step_Shot names that the run record does not name. The run
 * record is the printed line per step; a shot missing from it is a FAIL.
 */
export function shotsMissingFromRecord(
  record: string,
  expected: readonly string[],
): string[] {
  return expected.filter((name) => !record.includes(RECORD_SHOT_PREFIX + name));
}

/* ---------------------------------------------------------------------------
 * Passkey prompt counting and the Q1.2 fail rules (live-walk.test.ts).
 * ------------------------------------------------------------------------- */

/**
 * Init script for `page.addInitScript`. It wraps `navigator.credentials.create`
 * and `navigator.credentials.get`, and records each call in
 * `window.__passkeyCalls` as `"create"` or `"get"` before the real call runs.
 * A call is counted even when the browser rejects it, so a cancelled prompt
 * still shows up. Plain string, so the page runs it unchanged.
 */
export const PASSKEY_INIT_SCRIPT = `(function () {
  var w = window;
  w.__passkeyCalls = [];
  var creds = w.navigator && w.navigator.credentials;
  if (!creds) return;
  ["create", "get"].forEach(function (kind) {
    var original = creds[kind];
    if (typeof original !== "function") return;
    creds[kind] = function () {
      w.__passkeyCalls.push(kind);
      return original.apply(this, arguments);
    };
  });
})();`;

export type PasskeyKind = "create" | "get";

/** Passkey prompts counted per kind, and in total. */
export type PasskeyCounts = { create: number; get: number; total: number };

/** Count the recorded `window.__passkeyCalls` entries. Unknown values are ignored. */
export function countPasskeyCalls(calls: readonly string[]): PasskeyCounts {
  const create = calls.filter((kind) => kind === "create").length;
  const get = calls.filter((kind) => kind === "get").length;
  return { create, get, total: create + get };
}

/**
 * Exact counts for one press. Only the kinds named in `expected` are checked.
 * For example `{ create: 1 }` after a release that should create one passkey.
 */
export function checkPasskeyCount(
  counts: PasskeyCounts,
  expected: Partial<Pick<PasskeyCounts, "create" | "get">>,
  label: string,
): StepCheck {
  const parts = (["create", "get"] as const)
    .filter((kind) => expected[kind] !== undefined)
    .map((kind) => ({
      kind,
      want: expected[kind] as number,
      got: counts[kind],
    }));
  const expectedText = parts
    .map((part) => `${part.kind} ${part.want}`)
    .join(", ");
  const expectation = `${label}: passkey prompts ${expectedText}`;
  const bad = parts.filter((part) => part.got !== part.want);
  if (bad.length === 0) {
    return { ok: true, expected: expectation, message: `PASS ${expectation}` };
  }
  return {
    ok: false,
    expected: expectation,
    message: `FAIL ${label}: ${bad
      .map((part) => `${part.kind} ${part.got}, expected ${part.want}`)
      .join("; ")}`,
  };
}

/**
 * An early release (the hold is let go before the timer fires) must not reach
 * the passkey. It leaves no prompt (`create` is 0) and no credential is stored.
 */
export function checkEarlyRelease(
  counts: PasskeyCounts,
  storedCredentials: number,
): StepCheck {
  const expected =
    "early release: passkey prompts create 0, and no credential is stored";
  const createOk = counts.create === 0;
  const credOk = storedCredentials === 0;
  if (createOk && credOk) {
    return { ok: true, expected, message: `PASS ${expected}` };
  }
  return {
    ok: false,
    expected,
    message: `FAIL early release: create ${counts.create}, stored credentials ${storedCredentials}`,
  };
}

/** The total passkey prompts across a walk step may never exceed two (Q1.2). */
export const MAX_PASSKEY_PROMPTS = 2;

export function checkPasskeyTotal(counts: PasskeyCounts): StepCheck {
  const expected = `at most ${MAX_PASSKEY_PROMPTS} passkey prompts`;
  if (counts.total <= MAX_PASSKEY_PROMPTS) {
    return {
      ok: true,
      expected,
      message: `PASS ${counts.total} passkey prompt(s), ${expected}`,
    };
  }
  return {
    ok: false,
    expected,
    message: `FAIL more than two passkey prompts: ${counts.total} seen`,
  };
}

/**
 * A second quick press during an open prompt must add no prompt. `before` and
 * `after` are the total counts either side of that press.
 */
export function checkQuickPressAddsNone(
  before: number,
  after: number,
): StepCheck {
  const expected =
    "a second quick press during a prompt adds no passkey prompt";
  if (after === before) {
    return { ok: true, expected, message: `PASS ${expected}` };
  }
  return {
    ok: false,
    expected,
    message: `FAIL a second quick press added ${after - before} passkey prompt(s)`,
  };
}

/**
 * The quick press of Q1.2 could not be made because the create prompt had already
 * closed (the virtual authenticator answers at once). Not a product defect, so the
 * check passes and says why it was not made.
 */
export function checkQuickPressNotMade(tag: string | null): StepCheck {
  const expected =
    "a second quick press during a prompt adds no passkey prompt";
  return {
    ok: true,
    expected,
    message: `SKIP the quick press: the create prompt had closed before it (step "${tag ?? "none"}")`,
  };
}

/**
 * The step names of spec 16, Requirement 2.1, for each track the walk reads.
 * `/demo/live` has six steps; a persona letter with figures has four.
 */
export const LIVE_TRACK_NAMES = [
  "Write",
  "Press the seal",
  "Wait",
  "Remember",
  "Break the seal",
  "Receipts",
] as const;
export const PERSONA_TRACK_NAMES = [
  "Remember",
  "Break the seal",
  "Read",
  "Receipts",
] as const;

/**
 * Requirement 17.1 (2.1): the step track lists exactly the expected names, in order,
 * and its phone line, when shown, reads "Step {n} of {total} · {label}" with the
 * label one of them.
 */
export function checkTrackNames(
  names: readonly string[] | null,
  phoneLine: string | null,
  expected: readonly string[],
): StepCheck {
  const want = `the step track reads "${expected.join(" · ")}"`;
  if (names === null) {
    return { ok: false, expected: want, message: "FAIL no step track on the page" };
  }
  const got = names.join(" · ");
  if (got !== expected.join(" · ")) {
    return { ok: false, expected: want, message: `FAIL the step track reads "${got}"` };
  }
  if (phoneLine !== null) {
    const match = /^Step (\d+) of (\d+) · (.+)$/.exec(phoneLine);
    const n = match ? Number(match[1]) : NaN;
    if (
      !match ||
      Number(match[2]) !== expected.length ||
      expected[n - 1] !== match[3]
    ) {
      return { ok: false, expected: want, message: `FAIL the phone line reads "${phoneLine}"` };
    }
  }
  return { ok: true, expected: want, message: `PASS the step track reads "${got}"` };
}

/** A box in CSS pixels, as `getBoundingClientRect` reports it. */
export type BoxRect = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

/**
 * Whether two boxes overlap in both axes. Edges that only touch do not count,
 * and an empty box (zero width or height) overlaps nothing.
 */
export function rectsIntersect(a: BoxRect, b: BoxRect): boolean {
  if (a.right <= a.left || a.bottom <= a.top) return false;
  if (b.right <= b.left || b.bottom <= b.top) return false;
  return (
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  );
}

/**
 * After a step change, the Step_Heading box must not sit under the Top_Bar.
 * Fails when the two boxes overlap.
 */
export function checkStepHeadingClearOfTopBar(
  heading: BoxRect,
  topBar: BoxRect,
): StepCheck {
  const expected =
    "the Step_Heading box is not under the Top_Bar after a step change";
  if (!rectsIntersect(heading, topBar)) {
    return { ok: true, expected, message: `PASS ${expected}` };
  }
  return {
    ok: false,
    expected,
    message: `FAIL the Step_Heading box (top ${heading.top}, bottom ${heading.bottom}) overlaps the Top_Bar (bottom ${topBar.bottom})`,
  };
}

/** The risen ghost must not intersect the Keep_Section (Q1.2). */
export function checkGhostClearOfKeep(
  ghost: BoxRect,
  keep: BoxRect,
): StepCheck {
  const expected = "the risen ghost does not intersect the Keep_Section";
  if (!rectsIntersect(ghost, keep)) {
    return { ok: true, expected, message: `PASS ${expected}` };
  }
  return {
    ok: false,
    expected,
    message: "FAIL the risen ghost intersects the Keep_Section",
  };
}

/** One orange button found on the Seal step. */
export type OrangeButton = { label: string; isPressEnvelope: boolean };

/**
 * On the Seal step the Press_Envelope is the only orange button (Q1.2). Any
 * other orange button fails and is named in the message.
 */
export function checkSealOrangeButtons(
  buttons: readonly OrangeButton[],
): StepCheck {
  const expected =
    "the Press_Envelope is the only orange button on the Seal step";
  const extra = buttons.filter((button) => !button.isPressEnvelope);
  if (extra.length === 0) {
    return { ok: true, expected, message: `PASS ${expected}` };
  }
  return {
    ok: false,
    expected,
    message: `FAIL ${extra.length} other orange button(s) on the Seal step: ${extra
      .map((button) => `"${button.label}"`)
      .join(", ")}`,
  };
}

/* ---------------------------------------------------------------------------
 * Seal checks (spec 13, Q1.3, Q1.4, U8, U9). Pure: the walk reads the page and
 * passes plain values in.
 * ------------------------------------------------------------------------- */

/** What the walk reads from one seal: its fingerprint, coarse signature and markup. */
export type SealMark = {
  hash: string | null;
  coarse: string | null;
  markup: string | null;
};

/** A seal with nothing read from it. Used when a stage could not read one. */
export const NO_SEAL: SealMark = { hash: null, coarse: null, markup: null };

/**
 * The relief paths of a seal's markup, as one string. Clip ids are normalised
 * the way `normaliseWaxSealIds` does it, so two seals with different React ids
 * compare equal when their relief is equal. Only `d` attributes count (the
 * notch, tick and ring paths).
 */
export function reliefPathOf(markup: string): string {
  const normalised = markup.replace(
    /wax-seal-[A-Za-z0-9_-]*-(left|right)/g,
    "wax-seal-$1",
  );
  return Array.from(normalised.matchAll(/\sd="([^"]*)"/g), (match) =>
    match[1].replace(/\s+/g, " ").trim(),
  ).join("|");
}

/**
 * Q1.3: the seal on the Wait step and the seal at Break the seal must have an
 * equal `data-seal-hash`, an equal normalised relief path and an equal
 * `data-coarse`. A missing value on either side fails.
 */
export function checkSealMarks(
  waitSeal: SealMark,
  breakSeal: SealMark,
): StepCheck {
  const expected =
    "Q1.3: the Wait step and Break the seal show equal data-seal-hash, relief path and data-coarse";
  const missing: string[] = [];
  if (!waitSeal.hash || !breakSeal.hash) missing.push("data-seal-hash");
  if (!waitSeal.coarse || !breakSeal.coarse) missing.push("data-coarse");
  if (!waitSeal.markup || !breakSeal.markup) missing.push("relief path");
  if (missing.length > 0) {
    return {
      ok: false,
      expected,
      message: `FAIL the seal is missing on one stage: ${missing.join(", ")}`,
    };
  }
  const differ: string[] = [];
  if (waitSeal.hash !== breakSeal.hash) differ.push("data-seal-hash");
  if (waitSeal.coarse !== breakSeal.coarse) differ.push("data-coarse");
  if (
    reliefPathOf(waitSeal.markup ?? "") !== reliefPathOf(breakSeal.markup ?? "")
  ) {
    differ.push("relief path");
  }
  if (differ.length === 0) {
    return { ok: true, expected, message: `PASS ${expected}` };
  }
  return {
    ok: false,
    expected,
    message: `FAIL the Wait step and Break the seal differ in ${differ.join(", ")}`,
  };
}

/**
 * Q1.4: a page that draws a seal must have it in the server HTML, so it shows
 * with JavaScript off. The marker is `data-landing-seal` (the Landing_Seal on
 * `/`) or a `data-seal-hash` on an `svg` (the seals on `/demo`, the persona page
 * and `/l/[id]`).
 */
export function checkNoJsSeal(label: string, html: string): StepCheck {
  const expected = `Q1.4: ${label} shows a seal in the server HTML with JavaScript off`;
  const found =
    /\sdata-landing-seal(=|\s|>)/.test(html) ||
    /<svg[^>]*\sdata-seal-hash="[^"]+"/.test(html);
  if (found) return { ok: true, expected, message: `PASS ${expected}` };
  return {
    ok: false,
    expected,
    message: `FAIL ${label}: no data-landing-seal or data-seal-hash in the server HTML`,
  };
}

/** U8: the seal at Break the seal is at least 160 px wide at 1440 and 120 px at 390. */
export function breakSealMinWidth(viewportWidth: number): number {
  return viewportWidth >= 1440 ? 160 : 120;
}

/**
 * U8: the seal at Break the seal is at least `minWidth` px across and sits
 * inside the viewport. `seal` is null when the page has no seal to measure.
 */
export function checkBreakSealSize(
  seal: BoxRect | null,
  viewport: { width: number; height: number },
  minWidth: number,
): StepCheck {
  const expected = `U8: the seal at Break the seal is at least ${minWidth} px wide and inside the viewport`;
  if (!seal) {
    return {
      ok: false,
      expected,
      message: "FAIL no seal found at Break the seal",
    };
  }
  const width = seal.right - seal.left;
  const inside =
    seal.left >= 0 &&
    seal.top >= 0 &&
    seal.right <= viewport.width &&
    seal.bottom <= viewport.height;
  if (width >= minWidth && inside) {
    return { ok: true, expected, message: `PASS ${expected} (${width} px)` };
  }
  return {
    ok: false,
    expected,
    message: `FAIL the seal at Break the seal is ${width} px wide${inside ? "" : " and outside the viewport"}, expected at least ${minWidth} px inside the viewport`,
  };
}

/** U9: each `/demo` persona seal is drawn at 96 CSS px. */
export const DEMO_SEAL_SIZE = 96;

/** U9: how many persona seals `/demo` draws. */
export const DEMO_SEAL_COUNT = 3;

/** One persona seal on `/demo`: its drawn width in CSS px and its `data-coarse`. */
export type DemoSeal = { width: number; coarse: string | null };

/**
 * U9: the three persona seals are each 96 CSS px wide (to within half a pixel),
 * and each has a different `data-coarse`, so they are told apart at a glance.
 */
export function checkDemoSeals(seals: readonly DemoSeal[]): StepCheck {
  const expected = `U9: ${DEMO_SEAL_COUNT} persona seals on /demo, each ${DEMO_SEAL_SIZE} px wide, with different data-coarse values`;
  if (seals.length !== DEMO_SEAL_COUNT) {
    return {
      ok: false,
      expected,
      message: `FAIL /demo draws ${seals.length} seal(s), expected ${DEMO_SEAL_COUNT}`,
    };
  }
  const wrongWidth = seals.filter(
    (seal) => Math.abs(seal.width - DEMO_SEAL_SIZE) > 0.5,
  );
  if (wrongWidth.length > 0) {
    return {
      ok: false,
      expected,
      message: `FAIL ${wrongWidth.length} persona seal(s) on /demo not ${DEMO_SEAL_SIZE} px: ${wrongWidth
        .map((seal) => `${seal.width} px`)
        .join(", ")}`,
    };
  }
  const coarse = seals.map((seal) => seal.coarse ?? "");
  const distinct = new Set(coarse.filter((value) => value.length > 0));
  if (
    coarse.some((value) => value.length === 0) ||
    distinct.size !== DEMO_SEAL_COUNT
  ) {
    return {
      ok: false,
      expected,
      message: `FAIL the persona seals on /demo do not have ${DEMO_SEAL_COUNT} different data-coarse values`,
    };
  }
  return { ok: true, expected, message: `PASS ${expected}` };
}

/**
 * The persona Tamper_Control run (A1, Q1.1 step `tamper`) makes no passkey
 * prompt. Any create or get call fails the run.
 */
export function checkTamperRunNoPasskey(counts: PasskeyCounts): StepCheck {
  const expected = "the persona tamper run makes no passkey prompt";
  if (counts.total === 0) {
    return { ok: true, expected, message: `PASS ${expected}` };
  }
  return {
    ok: false,
    expected,
    message: `FAIL the persona tamper run made ${counts.total} passkey prompt(s)`,
  };
}

/* ---------------------------------------------------------------------------
 * Q1.4 fail rules for the desk, the Seal step and the Step_Track (spec 14,
 * task 18). Pure: the walk reads the page and passes plain values in.
 * ------------------------------------------------------------------------- */

/** The Accent colour, `--accent: #ff7b1c` in `ceremony/scene/tokens.css`. */
export const ACCENT_COLOUR: RgbaColor = { r: 255, g: 123, b: 28, a: 1 };

/** The width at which the Press_Envelope must clear the text column (Q1.4). */
export const PRESS_CLEARANCE_WIDTH = 1440;

/**
 * The Press_Status_Line (S6.7, Q1.4). `actual` is the text the walk read from
 * `[data-press-line]`, and `expected` is the S6.7 copy for the current state.
 * An empty line fails, and so does any other text. The walk checks this before
 * the letter is stored, so a wrong line cannot pass unnoticed.
 */
export function checkPressStatusLine(
  actual: string | null,
  expected: string,
): StepCheck {
  const label = `the Press_Status_Line reads "${expected}" (S6.7)`;
  const text = (actual ?? "").trim();
  if (text === "") {
    return {
      ok: false,
      expected: label,
      message: `FAIL the Press_Status_Line is empty, expected "${expected}"`,
    };
  }
  if (text === expected) {
    return { ok: true, expected: label, message: `PASS ${label}` };
  }
  return {
    ok: false,
    expected: label,
    message: `FAIL the Press_Status_Line reads "${text}", expected "${expected}"`,
  };
}

/**
 * The Press_Envelope must not intersect the text column at 1440 px (Q1.4).
 * Other widths are not part of this rule, so they pass with a note that says so.
 */
export function checkPressEnvelopeClearOfText(
  envelope: BoxRect,
  textColumn: BoxRect,
  viewportWidth: number,
): StepCheck {
  const expected = `the Press_Envelope does not intersect the text column at ${PRESS_CLEARANCE_WIDTH} px`;
  if (viewportWidth !== PRESS_CLEARANCE_WIDTH) {
    return {
      ok: true,
      expected,
      message: `PASS not checked at ${viewportWidth} px (the rule applies at ${PRESS_CLEARANCE_WIDTH} px)`,
    };
  }
  if (!rectsIntersect(envelope, textColumn)) {
    return { ok: true, expected, message: `PASS ${expected}` };
  }
  return {
    ok: false,
    expected,
    message: `FAIL the Press_Envelope (left ${envelope.left}, right ${envelope.right}) intersects the text column (left ${textColumn.left}, right ${textColumn.right}) at ${viewportWidth} px`,
  };
}

/**
 * The Step_Track must not sit under the Top_Bar after a step change (Q1.4).
 * Fails when the two boxes overlap.
 */
export function checkStepTrackClearOfTopBar(
  track: BoxRect,
  topBar: BoxRect,
): StepCheck {
  const expected =
    "the Step_Track is not under the Top_Bar after a step change";
  if (!rectsIntersect(track, topBar)) {
    return { ok: true, expected, message: `PASS ${expected}` };
  }
  return {
    ok: false,
    expected,
    message: `FAIL the Step_Track (top ${track.top}, bottom ${track.bottom}) sits under the Top_Bar (bottom ${topBar.bottom})`,
  };
}

/**
 * The `[data-topbar-slot]` box must stay put from one step to the next (Q1.4).
 * `boxes` holds the slot's box at each step, in walk order. A missing box fails,
 * and so does any box that moves more than `tolerancePx` on any edge.
 */
export function checkTopbarSlotStable(
  boxes: readonly (BoxRect | null)[],
  tolerancePx = 1,
): StepCheck {
  const expected = "[data-topbar-slot] keeps the same box on every step";
  if (boxes.length === 0) {
    return {
      ok: false,
      expected,
      message: "FAIL no [data-topbar-slot] box was read",
    };
  }
  const missing = boxes.findIndex((box) => box === null);
  if (missing !== -1) {
    return {
      ok: false,
      expected,
      message: `FAIL [data-topbar-slot] is missing at step ${missing + 1}`,
    };
  }
  const first = boxes[0] as BoxRect;
  const moved = boxes.findIndex((box) => {
    const b = box as BoxRect;
    return (
      Math.abs(b.top - first.top) > tolerancePx ||
      Math.abs(b.left - first.left) > tolerancePx ||
      Math.abs(b.right - first.right) > tolerancePx ||
      Math.abs(b.bottom - first.bottom) > tolerancePx
    );
  });
  if (moved === -1) {
    return { ok: true, expected, message: `PASS ${expected}` };
  }
  const box = boxes[moved] as BoxRect;
  return {
    ok: false,
    expected,
    message: `FAIL [data-topbar-slot] moved between steps: step 1 at top ${first.top}, step ${moved + 1} at top ${box.top}`,
  };
}

/** The paint of one Figure_Row: its computed colours, and whether the row has focus. */
export type FigureRowPaint = {
  focused: boolean;
  border: string;
  background: string;
  /** The computed outline colour. Counted only while the row is focused. */
  outline: string;
};

/**
 * No Figure_Row may paint an Accent colour in its border or background, and in
 * its outline only while focused (Q1.4). A colour that cannot be read is a
 * failure, because the walk cannot show the row is free of Accent.
 */
export function checkFigureRowsNoAccent(
  rows: readonly FigureRowPaint[],
  accent: RgbaColor = ACCENT_COLOUR,
): StepCheck {
  const expected =
    "no Figure_Row paints an Accent colour in its border or background, and in its outline only while focused";
  const problems: string[] = [];
  let unmeasured = 0;
  rows.forEach((row, index) => {
    const props: { name: string; value: string }[] = [
      { name: "border", value: row.border },
      { name: "background", value: row.background },
    ];
    if (row.focused) props.push({ name: "outline", value: row.outline });
    for (const prop of props) {
      const colour = parseCssColor(prop.value);
      if (!colour) {
        unmeasured += 1;
        problems.push(
          `row ${index + 1} ${prop.name} "${prop.value}" could not be read`,
        );
        continue;
      }
      const isAccent =
        colour.a > 0 &&
        colour.r === accent.r &&
        colour.g === accent.g &&
        colour.b === accent.b;
      if (isAccent) {
        problems.push(
          `row ${index + 1} ${prop.name} is Accent (${prop.value})`,
        );
      }
    }
  });
  if (problems.length === 0) {
    return {
      ok: true,
      expected,
      message: `PASS ${expected} (${rows.length} row(s))`,
    };
  }
  return {
    ok: false,
    expected,
    message: `FAIL ${problems.length} Accent or unreadable colour(s), ${unmeasured} unreadable: ${problems.slice(0, 3).join("; ")}`,
  };
}

/**
 * At most one Accent button on the Write or Seal screen (Q1.4). `accentLabels`
 * lists the text of every button painted Accent. A second one fails and is
 * named in the message.
 */
export function checkAccentButtonCount(
  screen: "Write" | "Seal",
  accentLabels: readonly string[],
): StepCheck {
  const expected = `at most one Accent button on the ${screen} step`;
  if (accentLabels.length <= 1) {
    return {
      ok: true,
      expected,
      message: `PASS ${expected} (${accentLabels.length} found)`,
    };
  }
  return {
    ok: false,
    expected,
    message: `FAIL ${accentLabels.length} Accent buttons on the ${screen} step: ${accentLabels
      .map((label) => `"${label}"`)
      .join(", ")}`,
  };
}

/** The phrase the live Remember counter must not show (Q1.4). */
export const TESTIFY_COUNTER_FORBIDDEN = /you wrote this on/i;

/**
 * The live Remember counter (`[data-recall-counter]`) must not say "you wrote
 * this on" (Q1.4). A missing counter fails, because the check cannot run without it.
 */
export function checkTestifyCounter(text: string | null): StepCheck {
  const expected = 'the live Remember counter does not say "you wrote this on"';
  if (text === null) {
    return {
      ok: false,
      expected,
      message: "FAIL the live Remember counter is missing",
    };
  }
  if (!TESTIFY_COUNTER_FORBIDDEN.test(text)) {
    return {
      ok: true,
      expected,
      message: `PASS ${expected} (counter reads "${text.trim()}")`,
    };
  }
  return {
    ok: false,
    expected,
    message: `FAIL the live Remember counter reads "${text.trim()}"`,
  };
}

/**
 * The fold check on an unanswered question (spec 15, R7.4). Pressing the fold
 * with question `question` unanswered must show its message once, and move focus
 * to its answer field. `focusedAnswer` is the 1-based number of the answer field
 * that has focus, or null when focus is elsewhere. `message` is the desk's line
 * for that question, with its number filled in.
 */
export function checkUnansweredFold(input: {
  question: number;
  focusedAnswer: number | null;
  bodyText: string;
  foldSummaries: number;
  message: string;
}): StepCheck {
  const expected = `the fold names question ${input.question} and focus moves to its answer field`;
  const named = input.bodyText.replace(/\s+/g, " ").includes(input.message);
  if (
    named &&
    input.focusedAnswer === input.question &&
    input.foldSummaries === 1
  ) {
    return { ok: true, expected, message: `PASS ${expected}` };
  }
  const focus =
    input.focusedAnswer === null
      ? "nothing answer-shaped"
      : `answer ${input.focusedAnswer}`;
  return {
    ok: false,
    expected,
    message: `FAIL focus is on ${focus}, the line "${input.message}" is ${named ? "shown" : "missing"}, and ${input.foldSummaries} [data-fold-summary] element(s) are shown`,
  };
}

/**
 * The Remember step answers one author question (typed text) and, in the
 * one-figure variant, one figure question (a number or a scale). Without a
 * figure in the letter, no figure question is expected.
 */
export function checkTestifyKinds(input: {
  authorAnswered: number;
  figureAnswered: number;
  hasFigure: boolean;
}): StepCheck {
  const expected =
    "the Remember step answers at least one author question, and one figure question when the letter has a figure";
  const figureOk = !input.hasFigure || input.figureAnswered >= 1;
  if (input.authorAnswered >= 1 && figureOk) {
    return { ok: true, expected, message: `PASS ${expected}` };
  }
  return {
    ok: false,
    expected,
    message: `FAIL the Remember step answered ${input.authorAnswered} author question(s) and ${input.figureAnswered} figure question(s)`,
  };
}

/* ---------------------------------------------------------------------------
 * Persona walk checks (spec 18, Requirements 16.1 to 16.5). The Live_Walk reads
 * the page and passes the text it found in. These functions decide.
 * ------------------------------------------------------------------------- */

/** The three persona slugs the Live_Walk visits, in walk order. */
export const WALK_PERSONA_KEYS = ["us-maya", "eu-tomas", "us-priya"] as const;

export type WalkPersonaKey = (typeof WALK_PERSONA_KEYS)[number];

/** The fuel personas have a memory line and a receipts step with figures. Priya has neither. */
export const FUEL_PERSONA_KEYS: ReadonlySet<string> = new Set([
  "us-maya",
  "eu-tomas",
]);

/** The fields of a Persona_List entry that the date checks read. */
export type PersonaDateRow = {
  key: string;
  written_as_of: string;
  opens_at: string;
};

/** The date strings a persona step shows, each formatted by `letter-date.ts`. */
export type PersonaDateExpectation = {
  key: string;
  /** "17 November 2024", from `written_as_of` (`letterDisclosure`). */
  writtenAsOf: string;
  /** "November 2024", from `written_as_of` (the memory line, fuel personas only). */
  memoryMonth: string;
  /** "17 November 2026", from the date part of `opens_at` (`envelopeOpens`). */
  opensOn: string;
};

/**
 * Format a Persona_List entry's dates with the `letter-date.ts` formatters. The
 * formatters return "" for an unreadable date, and the checks below fail on "".
 */
export function expectedPersonaDates(
  row: PersonaDateRow,
): PersonaDateExpectation {
  return {
    key: row.key,
    writtenAsOf: formatCalendarDate(row.written_as_of),
    memoryMonth: formatCalendarMonth(row.written_as_of),
    opensOn: formatLetterDate(
      row.opens_at,
      letterZoneFor("persona", row.opens_at, "UTC"),
    ),
  };
}

/** Which persona date strings a step shows. Only the flagged ones are checked. */
export type PersonaDateSlots = {
  written?: boolean;
  memory?: boolean;
  opening?: boolean;
};

/**
 * Check that a step's text contains each persona date its slots flag. A value
 * that `letter-date.ts` could not format fails, so an empty expectation never passes.
 */
export function checkPersonaDateStrings(
  expected: PersonaDateExpectation,
  stepText: string,
  shows: PersonaDateSlots,
): StepCheck {
  const required: { label: string; value: string }[] = [];
  if (shows.written) {
    required.push({ label: "written as of", value: expected.writtenAsOf });
  }
  if (shows.memory) {
    required.push({ label: "memory month", value: expected.memoryMonth });
  }
  if (shows.opening) {
    required.push({ label: "opens on", value: expected.opensOn });
  }
  const expectation = required.length
    ? required.map((item) => `${item.label} "${item.value}"`).join(", ")
    : "no persona date";
  const unformatted = required.filter((item) => item.value === "");
  if (unformatted.length > 0) {
    return {
      ok: false,
      expected: expectation,
      message: `FAIL ${expected.key}: letter-date.ts formatted no ${unformatted
        .map((item) => item.label)
        .join(", ")} from personas.json`,
    };
  }
  const missing = required.filter((item) => !stepText.includes(item.value));
  if (missing.length === 0) {
    return {
      ok: true,
      expected: expectation,
      message: `PASS ${expected.key} shows ${expectation}`,
    };
  }
  return {
    ok: false,
    expected: expectation,
    message: `FAIL ${expected.key} does not show ${missing
      .map((item) => `${item.label} "${item.value}"`)
      .join(", ")}`,
  };
}

/** The approved sealed-for-demo wording (spec 18, Requirement 10.5). `{sealedAt}` is the date. */
export const SEALED_FOR_DEMO_TEMPLATE =
  "Sealed later, for this demo, on {sealedAt}.";

/**
 * The sealed-for-demo line expected for a served header's `sealedAt`, with the
 * date in the en-GB long form (UTC, as personas are shown). Null when unreadable.
 */
export function expectedSealedForDemoLine(sealedAt: string): string | null {
  const date = formatLetterDate(sealedAt, { kind: "utc" });
  return date === "" ? null : SEALED_FOR_DEMO_TEMPLATE.replace("{sealedAt}", date);
}

/**
 * Check the sealed-for-demo line on the page against the served header's
 * `sealedAt` and the approved wording. `line` is null when the page shows no such line.
 */
export function checkSealedForDemoLine(
  line: string | null,
  headerSealedAt: string | null,
): StepCheck {
  const expected =
    headerSealedAt === null ? null : expectedSealedForDemoLine(headerSealedAt);
  if (expected === null) {
    return {
      ok: false,
      expected: "a header sealedAt that parses",
      message: "FAIL the served header has no readable sealedAt",
    };
  }
  if (line === null) {
    return {
      ok: false,
      expected: `"${expected}"`,
      message: `FAIL no sealed-for-demo line on the page, expected "${expected}"`,
    };
  }
  if (line.trim() === expected) {
    return {
      ok: true,
      expected: `"${expected}"`,
      message: `PASS sealed-for-demo line reads "${expected}"`,
    };
  }
  return {
    ok: false,
    expected: `"${expected}"`,
    message: `FAIL sealed-for-demo line reads "${line.trim()}", expected "${expected}"`,
  };
}

/** Old_Persona_Date forms (spec 18 glossary). Each is matched as a whole token. */
export const OLD_PERSONA_DATE_FORMS: readonly string[] = [
  "2024-05-12",
  "12 May 2024",
  "12 May",
  "May 2024",
  "2024-11-05",
  "2024-11-05T00:00:00.000Z",
  "5 November 2024",
  "5 Nov 2024",
  "2024-06-09",
  "2024-06-09T00:00:00.000Z",
  "9 June 2024",
  "9 Jun 2024",
];

/** Pre-reseal price strings, in the sign form and the "EUR" form the ticket uses. */
export const PRE_RESEAL_PRICES: readonly string[] = [
  "$3.64",
  "$3.89",
  "€1.79",
  "€1.65",
  "EUR 1.79",
  "EUR 1.65",
];

/** Escape a literal for use inside a RegExp. */
function escapeForRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Return the Old_Persona_Date forms and pre-reseal price strings found in `text`,
 * in list order. A term inside a longer number or word does not count
 * (so "15 Nov 2024" or "$3.640" do not match).
 */
export function findStaleWalkText(text: string): string[] {
  return [...OLD_PERSONA_DATE_FORMS, ...PRE_RESEAL_PRICES].filter((term) =>
    new RegExp(`(?<![\\w.-])${escapeForRegExp(term)}(?![\\w-])`).test(text),
  );
}

/**
 * Check letter text and Price_Lines (`texts`) for stale strings. `where` names
 * the step or the persona in the message, for example "us-maya letter text".
 */
export function checkWalkLetterText(
  texts: readonly string[],
  where: string,
): StepCheck {
  const expected = "no Old_Persona_Date and no pre-reseal price string";
  const found = new Set<string>();
  for (const text of texts) {
    for (const hit of findStaleWalkText(text)) found.add(hit);
  }
  if (found.size === 0) {
    return {
      ok: true,
      expected,
      message: `PASS ${where} has no Old_Persona_Date or pre-reseal price`,
    };
  }
  return {
    ok: false,
    expected,
    message: `FAIL ${where} shows ${[...found]
      .map((term) => `"${term}"`)
      .join(", ")}`,
  };
}

/** One figure as the Live_Walk read it from the Receipts step. Values are already as shown. */
export type ReceiptFigureRead = {
  metricId: string;
  then: { value: string; period: string; retrievedAt: string };
  atOpening: { value: string; period: string; retrievedAt: string };
};

/** One line of the receipts report: a value and its period, for one side of one metric. */
export type ReceiptsReportRow = {
  metricId: string;
  side: "then" | "at opening";
  value: string;
  period: string;
};

/** One "historical record, retrieved" date, read from `retrieved_at` (its date part). */
export type ReceiptsRetrieved = {
  metricId: string;
  side: "then" | "at opening";
  retrievedOn: string;
};

export type ReceiptsReport = {
  persona: string;
  rows: ReceiptsReportRow[];
  retrieved: ReceiptsRetrieved[];
  lines: string[];
};

/**
 * Build the receipts report for a fuel persona: four rows per metric (then value
 * and period, at-opening value and period) and one retrieved date per side. The
 * values are passed in as read from the page, so nothing is typed by hand.
 * Throws RangeError for a non-fuel persona or a `retrieved_at` without a date part.
 */
export function buildReceiptsReport(
  persona: string,
  figures: readonly ReceiptFigureRead[],
): ReceiptsReport {
  if (!FUEL_PERSONA_KEYS.has(persona)) {
    throw new RangeError(`buildReceiptsReport: ${persona} has no figures`);
  }
  const rows: ReceiptsReportRow[] = [];
  const retrieved: ReceiptsRetrieved[] = [];
  for (const figure of figures) {
    const sides = [
      { side: "then" as const, read: figure.then },
      { side: "at opening" as const, read: figure.atOpening },
    ];
    for (const { side, read } of sides) {
      const retrievedOn = read.retrievedAt.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(retrievedOn)) {
        throw new RangeError(
          `buildReceiptsReport: retrieved_at has no date part: "${read.retrievedAt}"`,
        );
      }
      rows.push({
        metricId: figure.metricId,
        side,
        value: read.value,
        period: read.period,
      });
      retrieved.push({ metricId: figure.metricId, side, retrievedOn });
    }
  }
  const lines = [
    ...rows.map(
      (row) =>
        `${persona} | ${row.metricId} | ${row.side} | ${row.value} | ${row.period}`,
    ),
    ...retrieved.map(
      (item) =>
        `${persona} | ${item.metricId} | ${item.side} | historical record, retrieved ${item.retrievedOn}`,
    ),
  ];
  return { persona, rows, retrieved, lines };
}
