/**
 * Live_Walk (spec 14, Q1 and Q2). Skipped unless WALK=1.
 *
 * Drives the walk from the Write desk to Close in headless Chromium, with a
 * virtual WebAuthn authenticator that reports PRF support. The live runs come
 * from WALK_MATRIX (each width, with no figure or one figure, motion on and
 * reduced), plus the Seal_Button and Skip_Link breaks at 1440 and one Space-key
 * run. The persona runs walk Maya's Read step and press the Tamper_Control
 * (TAMPER_MATRIX). Step_Shots are saved under `qa-shots/live-walk/`. The matrix
 * is in `live-walk-matrix.ts` and the checks are in `live-walk-helpers.ts`.
 *
 * Product failures are not test failures. The walk records each one with its
 * step, the expected result, the observed result and the suspected file, and
 * prints them under "For task 19". A test fails only when the walk itself
 * breaks: the browser cannot start, or the walk throws outside a stage.
 *
 * How to run by hand:
 *   1. npm run build
 *   2. Start PostgreSQL locally and apply the migrations.
 *   3. Start the app:
 *        RP_ID=localhost APP_ORIGIN=http://localhost:3000 npx next start
 *   4. In another shell, run:
 *        WALK=1 RP_ID=localhost APP_ORIGIN=http://localhost:3000 \
 *          npx vitest run src/test/integration/live-walk.test.ts
 *
 * It needs headless Chromium, so it cannot run in CI without a browser. Without
 * WALK=1 the suites are skipped and exit 0.
 */
import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";

import { chromium, type BrowserContext, type Page } from "playwright-core";
import { describe, expect, it } from "vitest";

import { LIVE_COPY } from "../../components/live/copy";
import { DESK_COPY } from "../../components/live/desk/copy";
import { SEAL_PRESS_HOLD_MS } from "../../components/live/press/constants";
import { PRESS_COPY } from "../../components/live/press/copy";
import { TAMPER_COPY } from "../../components/reveal/tamper/tamper-copy";

import {
  BREAK_METHODS,
  FULL_PAGE_STEPS,
  MOTION_CONTROL_SELECTOR,
  NO_SEAL,
  PASSKEY_INIT_SCRIPT,
  STEP_SUSPECTED_FILES,
  WALK_SIZES,
  advanceSettle,
  breakSealMinWidth,
  checkAccentButtonCount,
  checkBreakSealSize,
  checkDemoSeals,
  checkEarlyRelease,
  checkFigureRowsNoAccent,
  checkGhostClearOfKeep,
  checkNoJsSeal,
  checkPasskeyCount,
  checkPasskeyTotal,
  checkPressEnvelopeClearOfText,
  checkPressStatusLine,
  checkQuickPressAddsNone,
  checkRunShots,
  checkSealMarks,
  checkSealOrangeButtons,
  checkStepHeadingClearOfTopBar,
  checkStepSnapshot,
  checkStepTrackClearOfTopBar,
  checkTamperRunNoPasskey,
  checkTestifyKinds,
  checkTopbarSlotStable,
  checkUnansweredFold,
  countPasskeyCalls,
  defectsFromChecks,
  missingShotDefect,
  RECORD_SHOT_PREFIX,
  recordStepResult,
  sealPressInput,
  shotsMissingFromRecord,
  shotsWrittenSince,
  skipLinkBlocksSettle,
  walkShotName,
  type BoxRect,
  type BreakMethod,
  type ClippedSample,
  type ContrastSample,
  type DemoSeal,
  type FigureRowPaint,
  type OrangeButton,
  type PageSnapshot,
  type PasskeyCounts,
  type SealMark,
  type SettleState,
  type ShotFile,
  type StepCheck,
  type WalkDefect,
  type WalkStepName,
  type WalkStepResult,
} from "./live-walk-helpers";
import {
  KEYBOARD_MATRIX_ENTRY,
  TAMPER_MATRIX,
  WALK_MATRIX,
  matrixRun,
  walkEnabled,
} from "./live-walk-matrix";

const BASE_URL = "http://localhost:3000";

/** Text the walk types as the letter. The walk checks it comes back unchanged. */
const LETTER_TEXT =
  "Walk letter: I will check the petrol price again next autumn.";
/** The question the walk writes after pressing "Write my own". */
const WALK_OWN_QUESTION =
  "What did you hope for the year ahead, the day you sealed this?";
/** The persona whose seal and tamper control the walk checks (spec 13, Q1.4, A1). */
const PERSONA_KEY = "us-maya";
/** A fixed wait for the 30-second demo lock, plus a margin. */
const LOCK_WAIT_MS = 31_000;
const STEP_TIMEOUT_MS = 30_000;
/** Whole-run budget for one run. */
const VIEWPORT_TIMEOUT_MS = 10 * 60_000;
/** How long the screen must hold still before a Step_Shot is taken. */
const SETTLE_MS = 300;
/** How long the seal is held down for the press-and-hold break. */
const HOLD_MS = 2_500;
/** How long the Seal step's press is held: the press threshold plus a margin (Q1.3). */
const SEAL_HOLD_WAIT_MS = SEAL_PRESS_HOLD_MS + 200;
/** Folder for the Step_Shots of the walk. Git-ignored. */
const LIVE_WALK_SHOTS = path.resolve("qa-shots", "live-walk");
/** Q1.4 pages: each one must show its seal in the server HTML with JavaScript off. */
const NO_JS_PATHS = ["/", "/demo", `/demo/personas/${PERSONA_KEY}`] as const;

type Cdp = Awaited<ReturnType<BrowserContext["newCDPSession"]>>;

type WalkContext = {
  page: Page;
  cdp: Cdp;
  authenticatorId: string;
  /** Filled at unlock: the `/l/<id>` path of the sealed letter, for the Q1.4 page check. */
  letter: { path: string | null };
};

/**
 * One stage's action. It receives the stage's `checks` array and pushes the
 * checks it makes into it. Its returned text is the observation for the record.
 */
type WalkAction = (ctx: WalkContext, checks: StepCheck[]) => Promise<string>;

/** One run: the width, motion, figure, break method, keyboard flag and persona flag. */
type WalkRun = {
  size: { width: number; height: number };
  reduced: boolean;
  /** True for the one-figure variant: a public price is picked on the receipt. */
  figure: boolean;
  method: BreakMethod;
  /** True for the keyboard run: the seal is pressed with Space. */
  keyboard: boolean;
  /** True for the persona runs: no letter, no passkey, the Read step and Tamper_Control. */
  persona: boolean;
};

/**
 * One stage. `act` runs first; the stage is then checked and its Step_Shot is
 * taken. `afterShot`, if set, runs only when the act passed, after the shot, and
 * belongs to the same step.
 */
type StageAction = {
  step: WalkStepName;
  act: WalkAction;
  afterShot?: WalkAction;
};

type StageRow = {
  result: WalkStepResult;
  shot?: string;
};

/** What a walk run returns: its stage rows, the stages it reached, and the run-wide defects. */
type WalkResult = {
  rows: StageRow[];
  reached: WalkStepName[];
  letterPath: string | null;
  runDefects: WalkDefect[];
};

const BREAK_LABELS: Record<BreakMethod, string> = {
  hold: "press and hold",
  button: "the Seal_Button",
  skip: "the Skip_Link",
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The `data-ceremony` value of the Stage on screen, or an empty string. */
async function currentStage(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      document
        .querySelector("[data-ceremony]")
        ?.getAttribute("data-ceremony") ?? "",
  );
}

/**
 * Wait until the Stage has not changed, and no finite animation is running, for
 * SETTLE_MS. Infinite animations (the Ghost's idle motion) are left out, or the
 * screen would never settle.
 *
 * The Skip_Link is not part of the wait on the `marks` stage: it stays up there
 * by design (the shared rule `skipLinkVisible(showAll, broken)` in
 * ceremony/seal/skip-link.ts). On every other stage the wait holds until the
 * Skip_Link is gone, so the screen is not checked while it is still up. The
 * "skip" break method clicks it only after the marks Step_Shot has been saved.
 */
async function waitForStable(page: Page): Promise<void> {
  const deadline = Date.now() + STEP_TIMEOUT_MS;
  let settle: SettleState = { last: "", since: Date.now() };
  while (Date.now() < deadline) {
    const state = await page.evaluate(() => {
      const stage =
        document
          .querySelector("[data-ceremony]")
          ?.getAttribute("data-ceremony") ?? "";
      const running = document
        .getAnimations()
        .filter(
          (animation) =>
            animation.playState === "running" &&
            animation.effect?.getTiming().iterations !== Infinity,
        ).length;
      const skip = document.querySelector("[data-skip-link]");
      const skipLinkVisible =
        skip !== null && skip.getBoundingClientRect().width > 0;
      return { stage, running, skipLinkVisible };
    });
    if (skipLinkBlocksSettle(state.stage, state.skipLinkVisible)) {
      // Still waiting for the Skip_Link to go: the clock restarts once it has gone.
      settle = { last: "", since: Date.now() };
      await page.waitForTimeout(50);
      continue;
    }
    const step = advanceSettle(
      settle,
      `${state.stage}|${state.running}`,
      Date.now(),
      SETTLE_MS,
    );
    settle = step.next;
    if (step.settled) return;
    await page.waitForTimeout(50);
  }
  throw new Error(
    `The screen did not settle within ${STEP_TIMEOUT_MS} ms (last state ${settle.last}).`,
  );
}

/** Read the page facts that the Q1.6 checks need. The browser only collects; checks decide. */
async function readPage(
  c: WalkContext,
  consoleErrors: string[],
): Promise<PageSnapshot> {
  const raw = (await c.page.evaluate(() => {
    const isOpaque = (color: string): boolean => {
      const match = color.match(/rgba?\(([^)]+)\)/);
      if (!match) return false;
      const parts = match[1].split(/[\s,/]+/).filter((part) => part.length > 0);
      return parts.length < 4 || Number(parts[3]) === 1;
    };
    const clipCandidates: ClippedSample[] = [];
    const contrastSamples: ContrastSample[] = [];
    for (const el of Array.from(
      document.querySelectorAll<HTMLElement>("body *"),
    )) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (
        style.overflowX !== "visible" &&
        el.scrollWidth > el.clientWidth + 1
      ) {
        clipCandidates.push({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80),
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          overflowX: style.overflowX,
          className: el.getAttribute("class") ?? "",
        });
      }
      const text = Array.from(el.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text.length === 0) continue;
      const label = text.slice(0, 80);
      let background: string | null = null;
      for (let node: HTMLElement | null = el; node; node = node.parentElement) {
        const color = getComputedStyle(node).backgroundColor;
        if (isOpaque(color)) {
          background = color;
          break;
        }
      }
      contrastSamples.push({
        text: label,
        fg: style.color,
        bg: background,
        fontSizePx: parseFloat(style.fontSize),
        fontWeight: Number(style.fontWeight),
      });
    }
    const current = document.querySelector(
      "[data-live-stepper] [data-step-indicator] [aria-current='step']",
    );
    // Matches StepTrack: the ol inside [data-step-indicator] marks the
    // current li with aria-current="step" (LiveStepper.tsx wraps it in data-live-stepper).
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      clipCandidates,
      contrastSamples,
      currentStep: current?.textContent?.trim() ?? null,
      bodyText: document.body.innerText,
    };
  })) as Omit<PageSnapshot, "motionControls" | "consoleErrors">;

  const motionControls = await c.page.locator(MOTION_CONTROL_SELECTOR).count();
  return { ...raw, motionControls, consoleErrors };
}

/** The box of the first element matching the selector, or null when none is on the page. */
async function boxOf(page: Page, selector: string): Promise<BoxRect | null> {
  return (await page.evaluate((sel: string) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const box = el.getBoundingClientRect();
    return {
      top: box.top,
      right: box.right,
      bottom: box.bottom,
      left: box.left,
    };
  }, selector)) as BoxRect | null;
}

/**
 * The boxes the Q1.2 and Q1.4 layout rules compare, read from the page. A box is
 * null when its element is not on the page at this stage. The check that needs
 * it then does not run.
 */
type StepBoxes = {
  heading: BoxRect | null;
  topBar: BoxRect | null;
  track: BoxRect | null;
  ghost: BoxRect | null;
  keep: BoxRect | null;
};

async function readStepBoxes(page: Page): Promise<StepBoxes> {
  return {
    // The Step_Heading is the h2 of the card step (LiveStepper sets data-card).
    heading: await boxOf(page, "[data-live-stepper] [data-card] h2"),
    topBar: await boxOf(page, "[data-topbar]"),
    // The Step_Track (StepTrack.tsx sets data-step-track).
    track: await boxOf(page, "[data-step-track]"),
    // The risen ghost (Ghost.tsx sets data-ghost-rise) and the Keep_Section (U6).
    ghost: await boxOf(page, "[data-ghost-rise]"),
    keep: await boxOf(page, "[data-live-keep-section]"),
  };
}

/**
 * Every visible button on the page that is orange: its own background, or one of
 * its descendants', is the wax colour (`--wax`, #ff7b1c). The Press_Envelope is
 * flagged by its `data-press-mode` attribute (Q1.2).
 */
async function readOrangeButtons(page: Page): Promise<OrangeButton[]> {
  return page.evaluate(() => {
    const WAX = "rgb(255, 123, 28)";
    const isOrange = (el: Element): boolean =>
      [el, ...Array.from(el.querySelectorAll("*"))].some(
        (node) => getComputedStyle(node).backgroundColor === WAX,
      );
    return Array.from(document.querySelectorAll("button"))
      .filter((button) => {
        const style = getComputedStyle(button);
        const box = button.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          box.width > 0 &&
          box.height > 0 &&
          isOrange(button)
        );
      })
      .map((button) => ({
        label: (button.getAttribute("aria-label") ?? button.textContent ?? "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 80),
        isPressEnvelope: button.hasAttribute("data-press-mode"),
      }));
  });
}

/** The paint of every Figure_Row: its border, background and outline colours, and whether it has focus. */
async function readFigurePaint(page: Page): Promise<FigureRowPaint[]> {
  return (await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("[data-figure-row]")).map(
      (el) => {
        const style = getComputedStyle(el);
        return {
          focused: document.activeElement === el,
          border: style.borderTopColor,
          background: style.backgroundColor,
          outline: style.outlineColor,
        };
      },
    ),
  )) as FigureRowPaint[];
}

/** The Press_Status_Line text, or null when no line is on the page. */
async function readPressLine(page: Page): Promise<string | null> {
  const line = page.locator("[data-press-line]");
  if ((await line.count()) === 0) return null;
  return line.first().textContent();
}

/** Checks that the Testify counter says "you wrote this on" on every question it was read on (Q1.4). */
function checkWrittenOnCounter(texts: readonly (string | null)[]): StepCheck {
  const expected =
    'the live Testify counter says \"you wrote this on\" on every question';
  if (texts.length === 0) {
    return {
      ok: false,
      expected,
      message:
        "FAIL no Testify question was reached, so the counter was not read",
    };
  }
  const bad = texts.findIndex(
    (text) =>
      text === null || !text.toLowerCase().includes("you wrote this on"),
  );
  if (bad === -1) {
    return { ok: true, expected, message: `PASS ${expected}` };
  }
  const shown = texts[bad];
  return {
    ok: false,
    expected,
    message:
      shown === null
        ? `FAIL the live Testify counter is missing on question ${bad + 1}`
        : `FAIL the live Testify counter on question ${bad + 1} reads \"${shown.trim()}\"`,
  };
}

/** Checks that the Testify counter is shown on the desk's receipt checklist for an own number. */
function checkOwnNumberOnChecklist(text: string): StepCheck {
  const expected = "A receipt shows 1 own number after the own number is typed";
  if (/1 own number/.test(text)) {
    return { ok: true, expected, message: `PASS ${expected}` };
  }
  const shown = text.replace(/\s+/g, " ").trim();
  return {
    ok: false,
    expected,
    message: `FAIL A receipt reads "${shown}"`,
  };
}

/** Checks that the letter text is unchanged after an Occasion is picked. */
function checkDraftKept(
  actual: string,
  expected: string,
  after: string,
): StepCheck {
  const label = `the letter text is unchanged after ${after}`;
  if (actual === expected) {
    return { ok: true, expected: label, message: `PASS ${label}` };
  }
  return {
    ok: false,
    expected: label,
    message: `FAIL the letter text changed after ${after}: it reads \"${actual}\"`,
  };
}

/** Checks that the desk gained one question row for each step: the suggestion, then Write my own. */
function checkRowsGrew(counts: readonly number[]): StepCheck {
  const expected =
    "a suggested question and then Write my own each add one question row";
  if (counts.length === 3 && counts[1] > counts[0] && counts[2] > counts[1]) {
    return { ok: true, expected, message: `PASS ${expected}` };
  }
  return {
    ok: false,
    expected,
    message: `FAIL question rows read ${counts.join(", ")} (before, after the suggestion, after Write my own)`,
  };
}

/** Checks the public-figure rule on the public-price receipt: a figure was picked only in the one-figure variant. */
function checkSamePeriod(count: number, figure: boolean): StepCheck {
  const expected =
    "the receipts show [data-same-period] in the one-figure variant";
  if (!figure) {
    return {
      ok: true,
      expected,
      message:
        "PASS not checked in the no-figure variant (no receipt figure was picked)",
    };
  }
  if (count > 0) {
    return { ok: true, expected, message: `PASS ${expected} (${count} found)` };
  }
  return {
    ok: false,
    expected,
    message:
      "FAIL no [data-same-period] line is shown on the receipts of the one-figure variant",
  };
}

/** Checks that the skip backup choice is still selected after a return to the letter. */
function checkSkipKept(checked: boolean): StepCheck {
  const expected = "the Skip it choice is still selected after folding again";
  if (checked) return { ok: true, expected, message: `PASS ${expected}` };
  return {
    ok: false,
    expected,
    message: "FAIL the Skip it choice was not kept after folding again",
  };
}

/**
 * The Step_Shot name for one step of a run. The method suffix (`-via-button`,
 * `-via-skip`) comes from walkShotName, and the keyboard run adds `-keyboard`.
 */
function walkShotFor(run: WalkRun, step: WalkStepName): string {
  const name = walkShotName({
    step,
    width: run.size.width,
    height: run.size.height,
    reduced: run.reduced,
    method: run.method,
  });
  return run.keyboard ? name.replace(/\.png$/, "-keyboard.png") : name;
}

/** The Step_Shot names of a run for the given steps, in order. */
function runShotNames(run: WalkRun, steps: readonly WalkStepName[]): string[] {
  return steps.map((step) => walkShotFor(run, step));
}

/** A readable name for one run, used as the test title. */
function runLabel(run: WalkRun): string {
  const motion = run.reduced ? "reduced motion" : "motion on";
  const figures = run.figure ? "one figure" : "no figure";
  const keys = run.keyboard ? ", Space key" : "";
  return `${run.size.width}x${run.size.height}, ${motion}, ${figures}, break with ${run.method}${keys}`;
}

/** The passkey prompts the page has made so far, from window.__passkeyCalls (Q1.2). */
async function readPasskeyCounts(page: Page): Promise<PasskeyCounts> {
  return countPasskeyCalls(
    await page.evaluate(
      () =>
        (window as unknown as { __passkeyCalls?: string[] }).__passkeyCalls ??
        [],
    ),
  );
}

/** The prompts made between two reads. Only the create and get counts are differenced. */
function passkeyDelta(
  before: PasskeyCounts,
  after: PasskeyCounts,
): PasskeyCounts {
  const create = after.create - before.create;
  const get = after.get - before.get;
  return { create, get, total: create + get };
}

/**
 * Which expected Step_Shots this run wrote. Only files with an mtime at or after
 * `runStartMs` count, so a file from an earlier run cannot satisfy the check.
 */
function shotReport(expected: readonly string[], runStartMs: number) {
  const files: ShotFile[] = expected.flatMap((name) => {
    const file = path.join(LIVE_WALK_SHOTS, name);
    return existsSync(file) ? [{ name, mtimeMs: statSync(file).mtimeMs }] : [];
  });
  return checkRunShots(expected, shotsWrittenSince(files, runStartMs));
}

/** One line per step, then the Step_Shot line the record names. */
function formatStageRows(rows: readonly StageRow[]): string {
  return rows
    .map((row) => {
      const r = row.result;
      const label = r.pass ? "PASS" : "FAIL";
      return (
        `${r.step}: ${label}. ${r.observation}` +
        (row.shot ? ` ${RECORD_SHOT_PREFIX}${row.shot}` : "")
      );
    })
    .join("\n");
}

/** One product finding, as a line for the For task 19 block. */
function describeDefect(defect: WalkDefect): string {
  return `${defect.step}: ${defect.observed} Expected: ${defect.expected} Suspected file: ${defect.suspectedFile}`;
}

/**
 * Prints the run's record, its Step_Shot report and the For task 19 block. The
 * block holds every product finding: the stage defects, the run-wide defects,
 * the missing Step_Shots and any extra notes. Returns the Step_Shot names the
 * record does not name, which only the walk itself can cause.
 */
function reportRun(
  run: WalkRun,
  walk: WalkResult,
  runStartMs: number,
  notes: readonly string[],
): string[] {
  const record = formatStageRows(walk.rows);
  console.log(record);

  const expected = runShotNames(run, walk.reached);
  const shots = shotReport(expected, runStartMs);
  console.log(shots.lines.join("\n"));

  const findings = [
    ...walk.rows.flatMap((row) => row.result.defects.map(describeDefect)),
    ...walk.runDefects.map(describeDefect),
    ...shots.missing.map((name) => `missing Step_Shot ${name}`),
    ...notes,
  ];
  const reachedNote = `Stages reached: ${walk.reached.join(", ") || "none"}.`;
  const header = `Run: ${runLabel(run)}${run.persona ? " (persona)" : ""}. ${reachedNote}`;
  console.log(
    [
      "For task 19 (product findings. The walk does not fail on these.)",
      header,
      ...(findings.length > 0
        ? findings.map((line) => `- ${line}`)
        : ["- none"]),
    ].join("\n"),
  );
  return shotsMissingFromRecord(record, expected);
}

/** Presses the Seal step's envelope in the way the run calls for (Q1.3). */
async function pressSealEnvelope(c: WalkContext, run: WalkRun): Promise<void> {
  const press = c.page.getByRole("button", {
    name: PRESS_COPY.name,
    exact: true,
  });
  const input = sealPressInput({
    width: run.size.width,
    reduced: run.reduced,
    keyboard: run.keyboard,
  });
  if (input === "keyboard") {
    await press.focus();
    await c.page.keyboard.press("Space");
    return;
  }
  if (input === "click") {
    await press.click();
    return;
  }
  const box = await press.boundingBox();
  if (!box) {
    throw new Error("The Press the seal control has no size on screen.");
  }
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (input === "touch") {
    await c.cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    await c.page.waitForTimeout(SEAL_HOLD_WAIT_MS);
    await c.cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    return;
  }
  await c.page.mouse.move(x, y);
  await c.page.mouse.down();
  await c.page.waitForTimeout(SEAL_HOLD_WAIT_MS);
  await c.page.mouse.up();
}

/**
 * An early release (Q1.2): the mouse is let go well before the press threshold.
 * The hold timer must then cancel, so the walk waits past the threshold before it
 * reads the count. Only the desktop mouse hold is driven this way.
 */
async function pressSealEarly(c: WalkContext): Promise<void> {
  const press = c.page.getByRole("button", {
    name: PRESS_COPY.name,
    exact: true,
  });
  const box = await press.boundingBox();
  if (!box) {
    throw new Error("The Press the seal control has no size on screen.");
  }
  await c.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await c.page.mouse.down();
  await c.page.waitForTimeout(Math.floor(SEAL_PRESS_HOLD_MS / 4));
  await c.page.mouse.up();
  await c.page.waitForTimeout(SEAL_PRESS_HOLD_MS + 200);
}

/**
 * The recall stage: answer every question in turn, then go on. Reads the Testify
 * counter on each question into `counters`. Returns the count answered.
 */
async function answerEveryQuestion(
  c: WalkContext,
  counters: (string | null)[],
): Promise<{ author: number; figure: number }> {
  const recall = c.page.locator('[data-ceremony="recall"]');
  let author = 0;
  let figure = 0;
  let answered = 0;
  for (let guard = 0; guard < 12; guard += 1) {
    if ((await currentStage(c.page)) !== "recall") break;
    const counter = recall.locator("[data-recall-counter]");
    counters.push(
      (await counter.count()) > 0 ? await counter.first().textContent() : null,
    );
    const numberField = recall.locator('input[type="number"]').first();
    const textField = recall.locator('textarea, input[type="text"]').first();
    if ((await numberField.count()) > 0) {
      // A number question is a figure question (spec 15, R11.3).
      await numberField.fill("12");
      figure += 1;
    } else if ((await textField.count()) > 0) {
      // An author question: the testimony is typed as text.
      await textField.fill(`Walk answer ${author + 1}`);
      author += 1;
    } else {
      // A figure question's scale control. The Motion_Control is excluded: it is not an answer.
      const control = recall
        .locator('button[aria-label]:not([aria-label*="motion" i])')
        .first();
      if ((await control.count()) === 0) {
        throw new Error("No recall answer control found on the Testify stage.");
      }
      await control.click();
      figure += 1;
    }
    answered = author + figure;
    const next = recall
      .getByRole("button", {
        name: /^(next question|next|continue|submit|save)$/i,
      })
      .first();
    if ((await next.count()) > 0) {
      await next.click();
    } else {
      const last = recall
        .getByRole("button", { name: /break the seal|record|submit|save/i })
        .first();
      if ((await last.count()) > 0) await last.click();
      else break;
    }
    await c.page.waitForTimeout(300);
  }
  if (answered === 0) {
    throw new Error("No recall question field found.");
  }
  return { author, figure };
}

/**
 * Presses "Open your letter" on the Wait card, then the passkey unlock on the
 * Testify step (spec 15, R9.5 and R9.6). The Wait card has no link out of the
 * page any more, so the `/l/<id>` path is read from its Keep_Section first, for
 * the Q1.4 page check.
 */
async function openLetterAndUnlock(
  c: WalkContext,
  label: RegExp,
): Promise<void> {
  const keep = c.page.locator("[data-live-keep-section]");
  const keepText =
    (await keep.count()) > 0 ? await keep.first().innerText() : "";
  c.letter.path = /\/l\/[A-Za-z0-9_-]+/.exec(keepText)?.[0] ?? null;
  await c.page
    .getByRole("button", { name: LIVE_COPY.openLetter, exact: true })
    .click();
  await c.page.getByRole("button", { name: label }).click();
}

/**
 * Breaks the seal with the given method, then waits for the letter stage. The
 * marks stage is checked and shot before this runs.
 */
async function breakSeal(c: WalkContext, method: BreakMethod): Promise<string> {
  if (method === "hold") {
    const target = c.page.locator("[data-seal-target]").first();
    const box = await target.boundingBox();
    if (!box) {
      throw new Error("The seal target has no size on screen.");
    }
    await c.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await c.page.mouse.down();
    await c.page.waitForTimeout(HOLD_MS);
    await c.page.mouse.up();
  } else if (method === "button") {
    await c.page.locator("[data-seal-button]").click();
  } else {
    await c.page.locator("[data-skip-link]").click();
  }
  await c.page
    .locator('[data-ceremony="letter"]')
    .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
  return `Seal broken with ${BREAK_LABELS[method]}. Letter stage shown.`;
}

/** The seal the page draws: the first `svg` with a `data-seal-hash`. At Break the seal the search is limited to `[data-seal-target]`. */
async function readSealMark(page: Page, atBreak: boolean): Promise<SealMark> {
  return (await page.evaluate((scoped: boolean) => {
    const scope: ParentNode =
      (scoped ? document.querySelector("[data-seal-target]") : null) ??
      document;
    const svg = scope.querySelector<SVGElement>("svg[data-seal-hash]");
    if (!svg) return { hash: null, coarse: null, markup: null };
    return {
      hash: svg.getAttribute("data-seal-hash"),
      coarse: svg.getAttribute("data-coarse"),
      markup: svg.outerHTML,
    };
  }, atBreak)) as SealMark;
}

/** The on-screen box of the seal at Break the seal (U8), or null when none is drawn. */
async function readBreakSealBox(page: Page): Promise<BoxRect | null> {
  return (await page.evaluate(() => {
    const svg = document.querySelector("[data-seal-target] svg");
    if (!svg) return null;
    const box = svg.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return null;
    return {
      top: box.top,
      right: box.right,
      bottom: box.bottom,
      left: box.left,
    };
  })) as BoxRect | null;
}

/**
 * Q1.4 and U9. Loads `/`, `/demo`, the persona page and the walk's `/l/<id>` with
 * JavaScript disabled, then checks the seal markers in the HTML. Then, with
 * JavaScript on, measures the persona seals on `/demo` (U9). Runs after a live
 * walk, at the same viewport.
 */
async function checkSealPages(
  size: { width: number; height: number },
  letterPath: string | null,
): Promise<StepCheck[]> {
  const checks: StepCheck[] = [];
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  try {
    const paths: string[] = [...NO_JS_PATHS];
    if (letterPath) {
      paths.push(letterPath);
    } else {
      checks.push({
        ok: false,
        expected:
          "Q1.4: /l/[id] shows a seal in the server HTML with JavaScript off",
        message: "FAIL no letter was unlocked, so /l/[id] was not checked",
      });
    }
    const noJs = await browser.newContext({
      javaScriptEnabled: false,
      viewport: size,
    });
    try {
      for (const path of paths) {
        const page = await noJs.newPage();
        try {
          await page.goto(`${BASE_URL}${path}`, {
            waitUntil: "load",
            timeout: STEP_TIMEOUT_MS,
          });
          checks.push(checkNoJsSeal(path, await page.content()));
        } catch (error) {
          checks.push({
            ok: false,
            expected: `Q1.4: ${path} shows a seal in the server HTML with JavaScript off`,
            message: `FAIL ${path}: ${errorMessage(error)}`,
          });
        } finally {
          await page.close();
        }
      }
    } finally {
      await noJs.close();
    }

    const withJs = await browser.newContext({ viewport: size });
    try {
      const page = await withJs.newPage();
      await page.goto(`${BASE_URL}/demo`, {
        waitUntil: "load",
        timeout: STEP_TIMEOUT_MS,
      });
      const seals = (await page.evaluate(() =>
        Array.from(
          document.querySelectorAll<SVGSVGElement>("svg[data-seal-hash]"),
        ).map((svg) => ({
          width: svg.getBoundingClientRect().width,
          coarse: svg.getAttribute("data-coarse"),
        })),
      )) as DemoSeal[];
      checks.push(checkDemoSeals(seals));
    } catch (error) {
      checks.push({
        ok: false,
        expected: "U9: the persona seals on /demo are measured",
        message: `FAIL /demo: ${errorMessage(error)}`,
      });
    } finally {
      await withJs.close();
    }
  } finally {
    await browser.close();
  }
  return checks;
}

/**
 * Run stages in order in one browser session. Each stage: act, settle, check
 * (Q1.6), record (Q1.5), save its Step_Shot (Q2.1, Q2.2), run its follow-on
 * action. A stage whose act throws ends the run: the stages after it are not
 * reached. Every product finding goes into the stage's record, not into a thrown
 * error.
 */
async function runWalk(
  run: WalkRun,
  stages: readonly StageAction[],
): Promise<WalkResult> {
  mkdirSync(LIVE_WALK_SHOTS, { recursive: true });
  const rows: StageRow[] = [];
  const reached: WalkStepName[] = [];
  const letter: { path: string | null } = { path: null };
  const slotBoxes: (BoxRect | null)[] = [];
  let runDefects: WalkDefect[] = [];
  // The Wait step's seal, read so Break the seal can be compared with it (Q1.3).
  let waitSeal: SealMark | null = null;
  const { width, height } = run.size;

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  try {
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: run.reduced ? "reduce" : "no-preference",
    });
    // Counts passkey prompts in window.__passkeyCalls (Q1.2).
    await context.addInitScript(PASSKEY_INIT_SCRIPT);
    const page = await context.newPage();

    // Every console error and uncaught page error, in order. Each stage reads only its own.
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    // Virtual authenticator: CTAP2 internal, user-verified, PRF reported, auto-presence.
    const cdp = await context.newCDPSession(page);
    await cdp.send("WebAuthn.enable");
    const { authenticatorId } = (await cdp.send(
      "WebAuthn.addVirtualAuthenticator",
      {
        options: {
          protocol: "ctap2",
          transport: "internal",
          hasResidentKey: true,
          hasUserVerification: true,
          isUserVerified: true,
          hasPrf: true,
          automaticPresenceSimulation: true,
        },
      },
    )) as { authenticatorId: string };

    const ctx: WalkContext = { page, cdp, authenticatorId, letter };
    let seen = 0;

    for (const stage of stages) {
      const shotName = walkShotFor(run, stage.step);
      const suspectedFile = STEP_SUSPECTED_FILES[stage.step];
      const checks: StepCheck[] = [];

      let observed: string;
      let actionFailed = false;
      try {
        observed = await stage.act(ctx, checks);
      } catch (error) {
        actionFailed = true;
        observed = `Failed: ${errorMessage(error)}`;
      }
      reached.push(stage.step);

      const defects: WalkDefect[] = [];
      if (actionFailed) {
        defects.push({
          step: stage.step,
          expected: `The ${stage.step} stage is reached and its action completes.`,
          observed,
          suspectedFile,
        });
      } else {
        try {
          await waitForStable(page);
          const fresh = errors.slice(seen);
          seen = errors.length;
          const snapshot = await readPage(ctx, fresh);
          checks.push(
            ...checkStepSnapshot(stage.step, snapshot, {
              letterText: run.persona ? undefined : LETTER_TEXT,
            }),
          );
          // Q1.2 and Q1.4 layout rules, read on every step change. A rule whose
          // boxes are not on the page at this stage is not run, rather than passed on a guess.
          const boxes = await readStepBoxes(page);
          if (boxes.heading && boxes.topBar) {
            checks.push(
              checkStepHeadingClearOfTopBar(boxes.heading, boxes.topBar),
            );
          }
          if (boxes.track && boxes.topBar) {
            checks.push(checkStepTrackClearOfTopBar(boxes.track, boxes.topBar));
          }
          if (stage.step === "wait" && boxes.ghost && boxes.keep) {
            checks.push(checkGhostClearOfKeep(boxes.ghost, boxes.keep));
          }
          slotBoxes.push(await boxOf(page, "[data-topbar-slot]"));
          if (stage.step === "wait") {
            waitSeal = await readSealMark(page, false);
          }
          if (stage.step === "marks") {
            // Q1.3: the seal at Break the seal matches the one on the Wait step.
            // U8: the seal is at least the minimum size at this width.
            const breakSeal = await readSealMark(page, true);
            const box = await readBreakSealBox(page);
            checks.push(
              checkSealMarks(waitSeal ?? NO_SEAL, breakSeal),
              checkBreakSealSize(
                box,
                { width, height },
                breakSealMinWidth(width),
              ),
            );
          }
        } catch (error) {
          defects.push({
            step: stage.step,
            expected: "The screen settles after the stage's action.",
            observed: `Failed: ${errorMessage(error)}`,
            suspectedFile,
          });
        }
      }

      let shot: string | undefined;
      try {
        await page.screenshot({
          path: path.join(LIVE_WALK_SHOTS, shotName),
          fullPage: FULL_PAGE_STEPS.has(stage.step),
        });
        shot = shotName;
      } catch (error) {
        observed += ` (screenshot failed: ${errorMessage(error)})`;
      }
      // A step with no Step_Shot counts as failed, not passed (Q2.6, Q2.7).
      const noShot = missingShotDefect({
        step: stage.step,
        shot,
        expectedName: shotName,
        suspectedFile: "src/test/integration/live-walk.test.ts",
      });
      if (noShot) defects.push(noShot);

      // The follow-on action runs only after the stage has been checked and shot.
      if (stage.afterShot && !actionFailed) {
        try {
          observed += ` ${await stage.afterShot(ctx, checks)}`;
        } catch (error) {
          defects.push({
            step: stage.step,
            expected: `The ${stage.step} stage's follow-on action completes and the next stage is reached.`,
            observed: `Failed: ${errorMessage(error)}`,
            suspectedFile,
          });
        }
      }

      defects.push(...defectsFromChecks(stage.step, checks));
      rows.push({
        result: recordStepResult({
          step: stage.step,
          observation: observed,
          shots: shot ? [shot] : [],
          defects,
        }),
        shot,
      });
      if (actionFailed) break;
    }

    const lastStep: WalkStepName = reached[reached.length - 1] ?? "write";
    // Q1.4: the Top_Bar slot keeps its box from one step to the next.
    if (slotBoxes.length > 1) {
      runDefects = [
        ...runDefects,
        ...defectsFromChecks(lastStep, [checkTopbarSlotStable(slotBoxes)]),
      ];
    }
    // Q1.2: the whole run makes at most two passkey prompts.
    runDefects = [
      ...runDefects,
      ...defectsFromChecks(lastStep, [
        checkPasskeyTotal(await readPasskeyCounts(page)),
      ]),
    ];
    await context.close();
  } finally {
    await browser.close();
  }
  return { rows, reached, letterPath: letter.path, runDefects };
}

/**
 * The live stages, Write to Close, for one run. The one-figure variant ticks a
 * public price on the receipt. Every run types the own number, checks the
 * Testify counter and then walks the whole flow.
 */
function liveStages(run: WalkRun): StageAction[] {
  // The passkey count after the seal's create prompt, read again by the setting press.
  let afterRelease: PasskeyCounts | null = null;

  return [
    {
      step: "write",
      act: async (c, checks) => {
        await c.page.goto(`${BASE_URL}/demo/live`);
        const write = c.page.locator('[data-live-step="write"]');
        await write.waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        await c.page.locator("#live-letter").fill(LETTER_TEXT);
        await write
          .getByRole("button", {
            name: LIVE_COPY.occasionLabels.work,
            exact: true,
          })
          .click();
        await write
          .getByRole("button", {
            name: LIVE_COPY.occasionLabels.blank,
            exact: true,
          })
          .click();
        const kept = await c.page.locator("#live-letter").inputValue();
        checks.push(
          checkDraftKept(
            kept,
            LETTER_TEXT,
            "the Work and A blank page occasions",
          ),
        );
        return `Occasion picked (Work, then A blank page). Letter typed.`;
      },
    },
    {
      step: "write-occasion",
      act: async (c, checks) => {
        const rows = c.page.locator("[data-question-row]");
        const before = await rows.count();
        await c.page
          .getByRole("button", { name: /^Add the question:/ })
          .first()
          .click();
        const afterSuggestion = await rows.count();
        await c.page
          .getByRole("button", { name: DESK_COPY.writeOwn, exact: true })
          .click();
        const afterWriteOwn = await rows.count();
        // The question text is the row's textarea that is not an answer field.
        await rows
          .last()
          .locator("textarea:not([data-answer-input])")
          .fill(WALK_OWN_QUESTION);
        // Each question is answered when it is written (spec 15, R7.1).
        const answers = c.page.locator("[data-answer-input]");
        const answerCount = await answers.count();
        for (let i = 0; i < answerCount; i += 1) {
          await answers.nth(i).fill(`Walk answer to question ${i + 1}`);
        }
        checks.push(checkRowsGrew([before, afterSuggestion, afterWriteOwn]));
        return `Suggested question added, then Write my own pressed. Question rows: ${before}, ${afterSuggestion}, ${afterWriteOwn}. Each of ${answerCount} question(s) answered.`;
      },
    },
    {
      step: "write-receipt",
      act: async (c, checks) => {
        const panel = c.page.locator("[data-receipt-panel]").first();
        // At the phone width the receipt is a details element: open it first.
        const isDetails = await panel.evaluate(
          (el) => el.tagName === "DETAILS",
        );
        if (isDetails) {
          const open = await panel.evaluate(
            (el) => (el as HTMLDetailsElement).open,
          );
          if (!open) await panel.locator("summary").first().click();
        }
        let figureNote = "No public price (no-figure variant).";
        if (run.figure) {
          await c.page
            .getByRole("button", { name: DESK_COPY.togglePublic, exact: true })
            .click();
          await c.page.locator("[data-figure-row]").first().click();
          figureNote = "Public price ticked.";
        }
        await c.page
          .getByRole("button", { name: DESK_COPY.toggleOwn, exact: true })
          .click();
        const fields = c.page.locator("[data-own-number] input");
        const values = ["My rent", "1200", "EUR a month", "My city"];
        for (let i = 0; i < values.length; i += 1) {
          await fields.nth(i).fill(values[i]);
        }
        const checklist =
          (await c.page.locator("[data-checklist]").first().textContent()) ??
          "";
        checks.push(checkOwnNumberOnChecklist(checklist));
        return `Receipt opened. ${figureNote} Own number typed in all four fields.`;
      },
    },
    {
      step: "write-failed",
      act: async (c, checks) => {
        // Clear the answer to the last question, so the fold has one to name.
        const answers = c.page.locator("[data-answer-input]");
        const count = await answers.count();
        await answers.nth(count - 1).fill("");
        await c.page.locator("[data-fold-button]").first().click();
        const focusedAnswer = await c.page.evaluate(() => {
          const active = document.activeElement;
          if (!active || !active.hasAttribute("data-answer-input")) return null;
          const all = Array.from(
            document.querySelectorAll("[data-answer-input]"),
          );
          return all.indexOf(active) + 1;
        });
        const bodyText = await c.page.evaluate(() => document.body.innerText);
        const foldSummaries = await c.page
          .locator("[data-fold-summary]")
          .count();
        checks.push(
          checkUnansweredFold({
            question: count,
            focusedAnswer,
            bodyText,
            foldSummaries,
            message: DESK_COPY.answerMissing.replace("{n}", String(count)),
          }),
        );
        return `Last answer cleared and the letter folded. Focus on answer ${focusedAnswer ?? "none"}, ${foldSummaries} fold summary.`;
      },
    },
    {
      step: "write-receipts",
      act: async (c, checks) => {
        await c.page
          .locator("[data-answer-input]")
          .last()
          .fill("Walk answer to the last question.");
        const paints = await readFigurePaint(c.page);
        checks.push(checkFigureRowsNoAccent(paints));
        const orange = await readOrangeButtons(c.page);
        checks.push(
          checkAccentButtonCount(
            "Write",
            orange.map((button) => button.label),
          ),
        );
        return `Letter written again. ${paints.length} figure row(s) on the desk.`;
      },
      afterShot: async (c) => {
        await c.page.locator("[data-fold-button]").first().click();
        return "Folded.";
      },
    },
    {
      step: "seal",
      act: async (c, checks) => {
        await c.page
          .locator("[data-seal-step]")
          .first()
          .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        // Q1.2: on the Seal step the Press_Envelope is the only orange button.
        checks.push(checkSealOrangeButtons(await readOrangeButtons(c.page)));
        return "Press the seal step shown.";
      },
    },
    {
      step: "seal-before-choice",
      act: async (c, checks) => {
        // Q1.4: the Press_Status_Line is read before a backup choice is made.
        const line = await readPressLine(c.page);
        checks.push(checkPressStatusLine(line, PRESS_COPY.chooseFirst));
        // Q1.4: at 1440 the Press_Envelope does not intersect the text column.
        const envelope = await boxOf(c.page, "[data-press-mode]");
        const text = await boxOf(c.page, "[data-seal-text]");
        if (envelope && text) {
          checks.push(
            checkPressEnvelopeClearOfText(envelope, text, run.size.width),
          );
        } else {
          checks.push({
            ok: false,
            expected:
              "the Press_Envelope and the text column are on the page at the Seal step",
            message:
              "FAIL the Press_Envelope or the text column is not on the page",
          });
        }
        return `Press_Status_Line reads \"${line ?? ""}\" before a choice.`;
      },
    },
    {
      step: "seal-after-choice",
      act: async (c, checks) => {
        // Skip it is the explicit confirmation that unlocks the press (P7, P1.5).
        await c.page.locator('[data-backup-card="skip"]').first().click();
        const radio = c.page.locator(
          '[data-backup-card="skip"] input[type="radio"]',
        );
        checks.push(checkSkipKept(await radio.isChecked()));
        // Q1.4: the line for the motion setting. Reduced motion has no hold.
        const motionLine = run.reduced
          ? PRESS_COPY.pressToSeal
          : PRESS_COPY.holdToSeal;
        const line = await readPressLine(c.page);
        checks.push(checkPressStatusLine(line, motionLine));
        return `Skip it chosen. Press_Status_Line reads \"${line ?? ""}\".`;
      },
      afterShot: async (c, checks) => {
        await c.page
          .getByRole("button", { name: LIVE_COPY.backToLetter })
          .first()
          .click();
        const kept = await c.page.locator("#live-letter").inputValue();
        checks.push(checkDraftKept(kept, LETTER_TEXT, "Back to the letter"));
        await c.page.locator("[data-fold-button]").first().click();
        await c.page
          .locator("[data-seal-step]")
          .first()
          .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        const radio = c.page.locator(
          '[data-backup-card="skip"] input[type="radio"]',
        );
        checks.push(checkSkipKept(await radio.isChecked()));
        return "Back to the letter, the draft kept, folded again.";
      },
    },
    {
      step: "press-held",
      act: async (c, checks) => {
        const input = sealPressInput({
          width: run.size.width,
          reduced: run.reduced,
          keyboard: run.keyboard,
        });
        if (input === "hold") {
          await pressSealEarly(c);
          // Q1.2: an early release makes no prompt and stores no credential.
          const early = await readPasskeyCounts(c.page);
          const { credentials } = (await c.cdp.send("WebAuthn.getCredentials", {
            authenticatorId: c.authenticatorId,
          })) as { credentials: unknown[] };
          checks.push(checkEarlyRelease(early, credentials.length));
        }
        await pressSealEnvelope(c, run);
        // Q1.2: a second quick press while the passkey prompt is open adds no prompt.
        const beforeQuick = await readPasskeyCounts(c.page);
        await c.page
          .getByRole("button", { name: PRESS_COPY.name, exact: true })
          .click();
        const afterQuick = await readPasskeyCounts(c.page);
        checks.push(
          checkQuickPressAddsNone(beforeQuick.total, afterQuick.total),
        );
        await c.page
          .locator('[data-live-step="created"]')
          .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        // Q1.2: a release past the hold makes exactly one create prompt.
        afterRelease = await readPasskeyCounts(c.page);
        checks.push(
          checkPasskeyCount(afterRelease, { create: 1 }, "seal release"),
        );
        return `Seal pressed (${input}). The passkey is being created.`;
      },
    },
    {
      step: "setting",
      act: async (c, checks) => {
        // The Setting_State is one plain press, with no hold.
        await c.page.locator('[data-press-mode="setting"]').click();
        await c.page
          .locator('[data-live-step="sealed"]')
          .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        // Q1.2: the Setting_State press makes exactly one get prompt.
        const afterSetting = await readPasskeyCounts(c.page);
        checks.push(
          checkPasskeyCount(
            passkeyDelta(afterRelease ?? afterSetting, afterSetting),
            { get: 1 },
            "setting press",
          ),
        );
        const { credentials } = (await c.cdp.send("WebAuthn.getCredentials", {
          authenticatorId: c.authenticatorId,
        })) as { credentials: unknown[] };
        if (credentials.length === 0) {
          throw new Error(
            "The virtual authenticator holds no passkey after sealing.",
          );
        }
        return `Sealed. Virtual passkeys stored: ${credentials.length}.`;
      },
    },
    {
      step: "wait",
      act: async (c) => {
        await c.page.waitForTimeout(LOCK_WAIT_MS);
        return `Waited ${LOCK_WAIT_MS / 1000} seconds on the sealed page.`;
      },
    },
    {
      step: "open-letter",
      act: async (c) => {
        await openLetterAndUnlock(c, /unlock with your passkey/i);
        await c.page
          .locator('[data-ceremony="recall"]')
          .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        return '"Open your letter" pressed, unlocked with the passkey. Testify stage shown.';
      },
    },
    {
      step: "testify",
      act: async (c, checks) => {
        const counters: (string | null)[] = [];
        const answered = await answerEveryQuestion(c, counters);
        checks.push(checkWrittenOnCounter(counters));
        checks.push(
          checkTestifyKinds({
            authorAnswered: answered.author,
            figureAnswered: answered.figure,
            hasFigure: run.figure,
          }),
        );
        return `Answered ${answered.author} author and ${answered.figure} figure question(s). Counter read on each.`;
      },
    },
    {
      step: "marks",
      act: async (c) => {
        await c.page
          .locator('[data-ceremony="marks"]')
          .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        return "Break the seal stage shown, seal not yet touched.";
      },
      afterShot: (c) => breakSeal(c, run.method),
    },
    {
      step: "letter",
      act: async (c) => {
        await c.page
          .locator('[data-ceremony="letter"]')
          .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        return `Letter stage shown (${LETTER_TEXT.length} characters typed).`;
      },
    },
    {
      step: "figures",
      act: async (c, checks) => {
        if ((await currentStage(c.page)) === "letter") {
          // The letter stage's button is REVEAL_COPY.stage2Next, "See the receipts".
          const next = c.page
            .getByRole("button", { name: /see the receipts/i })
            .first();
          if ((await next.count()) === 0) {
            throw new Error("No See the receipts control on the letter stage.");
          }
          await next.click();
        }
        await c.page
          .locator('[data-ceremony="figures"], [data-ceremony="close"]')
          .first()
          .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        // Q1.4: the receipts of the one-figure variant show the same-period line.
        const samePeriod = await c.page.locator("[data-same-period]").count();
        checks.push(checkSamePeriod(samePeriod, run.figure));
        return `Receipts stage reached: ${await currentStage(c.page)}.`;
      },
    },
    {
      step: "close",
      act: async (c) => {
        if ((await currentStage(c.page)) === "figures") {
          // A letter with figures leaves the receipts by one more control.
          const next = c.page
            .getByRole("button", { name: /^(next|continue|close|done)$/i })
            .first();
          if ((await next.count()) === 0) {
            throw new Error("No control leads from the receipts to the Close.");
          }
          await next.click();
        }
        await c.page
          .locator('[data-ceremony="close"]')
          .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        return "Close stage shown.";
      },
    },
  ];
}

/**
 * The persona stages (A1). Persona-read opens Maya's letter, answers each
 * question, breaks the seal and waits for the Tamper_Control on the Read step.
 * Tamper presses the control and checks that no passkey prompt was made.
 */
function personaStages(): StageAction[] {
  return [
    {
      step: "persona-read",
      act: async (c) => {
        await c.page.goto(`${BASE_URL}/demo/personas/${PERSONA_KEY}`);
        const tamper = c.page.getByRole("button", {
          name: TAMPER_COPY.button,
          exact: true,
        });
        const advance = c.page
          .getByRole("button", {
            name: /^(see the receipts|next|continue|close)$/i,
          })
          .first();
        const counters: (string | null)[] = [];
        for (let guard = 0; guard < 12; guard += 1) {
          if (
            (await tamper.count()) > 0 &&
            (await tamper.first().isVisible())
          ) {
            return "Read step reached. Tamper_Control visible.";
          }
          const stage = await currentStage(c.page);
          if (stage === "recall") {
            await answerEveryQuestion(c, counters);
          } else if (stage === "marks") {
            await breakSeal(c, "button");
          } else if ((await advance.count()) > 0) {
            await advance.click();
            await c.page.waitForTimeout(300);
          } else {
            await c.page.waitForTimeout(300);
          }
        }
        throw new Error(
          "The Tamper_Control was not reached on the persona page.",
        );
      },
    },
    {
      step: "tamper",
      act: async (c, checks) => {
        const tamper = c.page.getByRole("button", {
          name: TAMPER_COPY.button,
          exact: true,
        });
        // A1: opening the Tamper_Control makes no passkey prompt, before or after the press.
        checks.push(checkTamperRunNoPasskey(await readPasskeyCounts(c.page)));
        await tamper.first().click();
        await c.page
          .locator("[data-tamper-result]")
          .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        checks.push(checkTamperRunNoPasskey(await readPasskeyCounts(c.page)));
        return "Tamper_Control pressed and its result shown.";
      },
    },
  ];
}

/** Every live run: the eight WALK_MATRIX entries, the Seal_Button and Skip_Link breaks at each width, and the Space-key run. */
const LIVE_RUNS: readonly WalkRun[] = [
  ...WALK_MATRIX.map((entry) => ({
    ...matrixRun(entry),
    method: "hold" as BreakMethod,
    keyboard: false,
    persona: false,
  })),
  ...WALK_SIZES.flatMap((size) =>
    BREAK_METHODS.filter((method) => method !== "hold").map((method) => ({
      size,
      reduced: false,
      figure: false,
      method,
      keyboard: false,
      persona: false,
    })),
  ),
  {
    size: {
      width: KEYBOARD_MATRIX_ENTRY.width,
      height: KEYBOARD_MATRIX_ENTRY.height,
    },
    reduced: false,
    figure: false,
    method: "hold",
    keyboard: true,
    persona: false,
  },
];

/** Every persona run: each width, with motion on and reduced (TAMPER_MATRIX). */
const PERSONA_RUNS: readonly WalkRun[] = TAMPER_MATRIX.map((entry) => ({
  size: { width: entry.width, height: entry.height },
  reduced: entry.reduced,
  figure: false,
  method: "hold" as BreakMethod,
  keyboard: false,
  persona: true,
}));

describe.skipIf(!walkEnabled(process.env))("live walk", () => {
  it.each(LIVE_RUNS.map((run) => [runLabel(run), run] as const))(
    "walks Write to Close: %s",
    async (_label, run) => {
      const runStartMs = Date.now();
      const walk = await runWalk(run, liveStages(run));
      const pageChecks = await checkSealPages(run.size, walk.letterPath);
      console.log(pageChecks.map((check) => check.message).join("\n"));
      const notes = pageChecks
        .filter((check) => !check.ok)
        .map((check) => check.message);
      reportRun(run, walk, runStartMs, notes);
      expect(walk.rows.length).toBeGreaterThan(0);
    },
    VIEWPORT_TIMEOUT_MS,
  );
});

describe.skipIf(!walkEnabled(process.env))("live walk: persona tamper", () => {
  it.each(PERSONA_RUNS.map((run) => [runLabel(run), run] as const))(
    "walks Maya's Read step and the Tamper_Control: %s",
    async (_label, run) => {
      const runStartMs = Date.now();
      const walk = await runWalk(run, personaStages());
      reportRun(run, walk, runStartMs, []);
      expect(walk.rows.length).toBeGreaterThan(0);
    },
    VIEWPORT_TIMEOUT_MS,
  );
});
