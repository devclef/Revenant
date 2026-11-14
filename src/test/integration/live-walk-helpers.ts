/**
 * Pure helpers for the Live_Walk (spec 12, Q1 and Q2). No browser, no network,
 * no imports. The walk replay in `live-walk.test.ts` uses them to name Step_Shots,
 * list the expected set, report missing shots, count Motion_Controls, look for
 * placeholder figures in the final reveal, and record each step's result.
 */

/** The ten steps of the walk, in order. `<step>` in a Step_Shot name is one of these. */
export const WALK_STEP_NAMES = [
  "write",
  "write-receipts",
  "seal",
  "wait",
  "unlock",
  "testify",
  "marks",
  "letter",
  "figures",
  "close",
] as const;

export type WalkStepName = (typeof WALK_STEP_NAMES)[number];

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
 * "See the receipts" from `letter` on. Steps not listed here are not checked.
 */
export const STEP_INDICATOR_EXPECTATIONS: Partial<
  Record<WalkStepName, RegExp>
> = {
  marks: /^break the seal$/i,
  letter: /^see the receipts$/i,
  figures: /^see the receipts$/i,
  close: /^see the receipts$/i,
};

/** The file a defect at each step most likely lives in. The owner confirms before fixing. */
export const STEP_SUSPECTED_FILES: Record<WalkStepName, string> = {
  write: "src/components/live/WriteForm.tsx",
  "write-receipts": "src/components/live/FigurePicker.tsx",
  seal: "src/components/live/SealPage.tsx",
  wait: "src/components/live/SealPage.tsx",
  unlock: "src/components/live/UnlockView.tsx",
  testify: "src/components/ceremony/recall/RecallPager.tsx",
  marks: "src/components/ceremony/seal/SealBreak.tsx",
  letter: "src/components/ceremony/letter/",
  figures: "src/components/ceremony/figures/",
  close: "src/components/ceremony/close/",
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
 * Text clipped by its container (Q1.6): a container with overflow not visible
 * whose content is wider than its box, by more than one pixel.
 *
 * A container only one pixel wide (clientWidth 1 or less) is visually hidden,
 * not clipped. The live stepper hides the names of steps not yet reached, and
 * the live announcer hides its text, both with a 1px box and `clip: rect(0 0 0 0)`
 * (live.module.css `.visuallyHidden`; the stepper's `.name`). Nothing the reader
 * sees is cut off there, so those containers are not flagged.
 */
export function checkClippedText(samples: readonly ClippedSample[]): StepCheck {
  const expected = "no text clipped by its container";
  const clipped = samples.filter(
    (s) =>
      s.overflowX !== "visible" &&
      s.clientWidth > 1 &&
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
  options: { letterText?: string } = {},
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
