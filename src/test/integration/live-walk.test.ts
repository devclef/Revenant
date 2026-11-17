/**
 * Live_Walk (Q1, Q2). Skipped unless WALK=1.
 *
 * Scope: the walk covers Write, seal, Wait, unlock, Testify, Break the seal,
 * letter, receipts and Close at 1440x900 and 390x844. The legacy W1 replay, its
 * run record, the backup-key and figures-unavailable variants, and the helpers
 * only it used are removed.
 *
 * Drives the walk from Write to Close in headless Chromium, with a virtual
 * WebAuthn authenticator that reports PRF support. Each run is one width (1440x900
 * or 390x844), with motion on or reduced, and one way of breaking the seal.
 * Step_Shots are saved under `qa-shots/live-walk/`. The matrix is in
 * `live-walk-matrix.ts` and the checks are in `live-walk-helpers.ts`.
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
  WALK_STEP_NAMES,
  advanceSettle,
  breakSealMinWidth,
  checkBreakSealSize,
  checkDemoSeals,
  checkNoJsSeal,
  checkEarlyRelease,
  checkGhostClearOfKeep,
  checkOwnNumberRowsBlank,
  checkSealOrangeButtons,
  checkStepHeadingClearOfTopBar,
  checkPasskeyCount,
  checkPasskeyTotal,
  checkQuickPressAddsNone,
  checkSealMarks,
  checkTamperRunNoPasskey,
  countPasskeyCalls,
  type PasskeyCounts,
  checkRunShots,
  checkStepSnapshot,
  defectsFromChecks,
  missingShotDefect,
  RECORD_SHOT_PREFIX,
  shotsMissingFromRecord,
  recordStepResult,
  shotsWrittenSince,
  sealPressInput,
  skipLinkBlocksSettle,
  walkShotName,
  type BoxRect,
  type BreakMethod,
  type DemoSeal,
  type OrangeButton,
  type SealMark,
  type SettleState,
  type StepCheck,
  type ShotFile,
  type ClippedSample,
  type ContrastSample,
  type PageSnapshot,
  type WalkDefect,
  type WalkStepName,
  type WalkStepResult,
} from "./live-walk-helpers";
import {
  KEYBOARD_MATRIX_ENTRY,
  TAMPER_MATRIX,
  WALK_MATRIX,
  matrixRun,
  matrixShotNames,
  tamperShotNames,
  walkEnabled,
} from "./live-walk-matrix";

const BASE_URL = "http://localhost:3000";

/** Text the Walk types as the letter. The reveal step checks it comes back unchanged. */
const LETTER_TEXT =
  "Walk letter: I will check the petrol price again next autumn.";
/** Question text the Walk writes for the future self. */
const WALK_QUESTION =
  "What do you remember paying for fuel the day you sealed this?";
/** A fixed wait for the 30-second demo lock, plus a margin. */
const LOCK_WAIT_MS = 31_000;
const STEP_TIMEOUT_MS = 30_000;
/** Whole-run budget for one viewport. */
const VIEWPORT_TIMEOUT_MS = 10 * 60_000;

type Cdp = Awaited<ReturnType<BrowserContext["newCDPSession"]>>;

type WalkContext = {
  page: Page;
  cdp: Cdp;
  authenticatorId: string;
  dir: string;
  /** Filled at unlock: the `/l/<id>` path of the sealed letter, for the Q1.4 page check. */
  letter: { path: string | null };
};

/** The persona whose seal and tamper control the walk checks (spec 13, Q1.4, A1). */
const PERSONA_KEY = "us-maya";

type WalkAction = (ctx: WalkContext) => Promise<string>;

/** Every screenshot must land under this folder. */
const QA_SHOTS_ROOT = path.resolve("qa-shots");

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Ticks the first figure checkbox on the write step (skipping the passkey
 * warning) and returns its label. Used by the stage walk.
 */
async function tickOneFigure(page: Page): Promise<string> {
  const boxes = page.locator('[data-live-step="write"] input[type="checkbox"]');
  const count = await boxes.count();
  for (let i = 0; i < count; i += 1) {
    const label = await boxes.nth(i).evaluate((el) => {
      const input = el as HTMLInputElement;
      return (
        input.labels?.[0]?.textContent ?? input.getAttribute("aria-label") ?? ""
      );
    });
    if (/lost|passkey|saved|warning/i.test(label)) continue;
    await boxes.nth(i).check();
    return label.trim();
  }
  throw new Error("No figure checkbox found on the write step.");
}

/**
 * Replay plan (Q1 and Q2). Skipped unless WALK=1. Each run of the matrix lists
 * the Step_Shot names it must produce. The browser walk for these runs is added
 * in a later step; this block only checks the plan is complete.
 */
describe.skipIf(!walkEnabled(process.env))("live walk matrix plan", () => {
  it("has eight runs: two widths, two variants, motion on and reduced", () => {
    expect(WALK_MATRIX).toHaveLength(8);
  });

  it.each(WALK_MATRIX.map((entry) => [entry.id, entry] as const))(
    "plans every Step_Shot for %s",
    (_id, entry) => {
      const names = matrixShotNames(entry);
      expect(names).toHaveLength(WALK_STEP_NAMES.length);
      expect(new Set(names).size).toBe(names.length);
    },
  );
});

/*
 * The walk from Write to Close (Q1, Q2). Skipped unless WALK=1.
 *
 * Each stage runs in one browser session per run. A run is one width, reduced or
 * not, with one way of breaking the seal (press and hold, the Seal_Button or the
 * Skip_Link). After every stage the page must settle, then the checks in Q1.6 run
 * on the real page, then a Step_Shot is saved under `qa-shots/live-walk/` (named
 * by `walkShotName`). A defect on a stage is recorded and the walk goes on to the next stage, so every reachable stage is checked and shot. It stops only when a stage's own action fails. Missing
 * Step_Shots print `FAIL missing Step_Shot <name>`.
 */

/** Folder for the Step_Shots of the walk. Git-ignored. */
const LIVE_WALK_SHOTS = path.resolve(QA_SHOTS_ROOT, "live-walk");
/** How long the screen must hold still before a Step_Shot is taken. */
const SETTLE_MS = 300;
/** How long the seal is held down for the press-and-hold break. */
const HOLD_MS = 2_500;
/** How long the Seal step's press is held: the press threshold plus a margin (Q1.3). */
const SEAL_HOLD_WAIT_MS = SEAL_PRESS_HOLD_MS + 200;

/**
 * Steps that depend on a task not yet merged. A failure at one of these is
 * recorded as expected-blocked instead of failed. None of the walk's stages is
 * listed: add an entry here with its task number when one is.
 */
const FIVE_STAGE_BLOCKED: Partial<
  Record<WalkStepName, { task: number; reason: string }>
> = {};

/**
 * One run: the width, whether motion is reduced, whether one figure is picked,
 * and how the seal is broken.
 */
type WalkRun = {
  size: { width: number; height: number };
  reduced: boolean;
  figure: boolean;
  method: BreakMethod;
  /** True for the keyboard run: the seal is pressed with Space. No matrix entry sets it yet. */
  keyboard: boolean;
};

/**
 * One stage. `act` runs first; the stage is then checked and its Step_Shot is
 * taken. `afterShot`, if set, runs only when the stage passed, after its shot,
 * and belongs to the same step.
 */
type StageAction = {
  step: WalkStepName;
  act: WalkAction;
  afterShot?: WalkAction;
  /** Checks the stage collected while it ran (passkey counts). Scored like the snapshot checks. */
  checks?: StepCheck[];
};

type StageRow = {
  result: WalkStepResult;
  shot?: string;
  blocked?: { task: number; reason: string };
};

const BREAK_LABELS: Record<BreakMethod, string> = {
  hold: "press and hold",
  button: "the Seal_Button",
  skip: "the Skip_Link",
};

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

/** Read the page facts that the Q1.6 checks need. The browser only collects; checks.ts decides. */
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
    // Matches StepIndicator.tsx: the ol inside [data-step-indicator] marks the
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

/**
 * The boxes the Q1.2 layout rules compare, read from the page. A box is null when
 * its element is not on the page at this stage. The check that needs it then
 * does not run.
 */
type StepBoxes = {
  heading: BoxRect | null;
  topBar: BoxRect | null;
  ghost: BoxRect | null;
  keep: BoxRect | null;
};

async function readStepBoxes(page: Page): Promise<StepBoxes> {
  const boxOf = (selector: string): Promise<BoxRect | null> =>
    page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const box = el.getBoundingClientRect();
      return {
        top: box.top,
        right: box.right,
        bottom: box.bottom,
        left: box.left,
      };
    }, selector);
  return {
    // The Step_Heading is the h2 of the card step (LiveStepper sets data-card).
    heading: await boxOf("[data-live-stepper] [data-card] h2"),
    topBar: await boxOf("[data-topbar]"),
    // The risen ghost (Ghost.tsx sets data-ghost-rise) and the Keep_Section (U6).
    ghost: await boxOf("[data-ghost-rise]"),
    keep: await boxOf("[data-live-keep-section]"),
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

/**
 * Run stages in order in one browser session. Each stage: act, settle, check
 * (Q1.6), record (Q1.5), save its Step_Shot (Q2.1, Q2.2). Stops at the first
 * stage with a defect or an action that threw.
 */
/** What a walk run returns: its stage rows, and the `/l/<id>` path if a letter was unlocked. */
type WalkResult = {
  rows: StageRow[];
  letterPath: string | null;
  /** Q1.2: the run-wide passkey total, scored through defectsFromChecks. */
  passkeyDefects: WalkDefect[];
};

async function runWalk(
  run: WalkRun,
  stages: readonly StageAction[],
): Promise<WalkResult> {
  mkdirSync(LIVE_WALK_SHOTS, { recursive: true });
  const rows: StageRow[] = [];
  const letter: { path: string | null } = { path: null };
  let passkeyDefects: WalkDefect[] = [];
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
    // Counts passkey prompts in window.__passkeyCalls (Q1.2). Read by the tamper run.
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

    const ctx: WalkContext = {
      page,
      cdp,
      authenticatorId,
      dir: LIVE_WALK_SHOTS,
      letter,
    };
    let seen = 0;

    for (const stage of stages) {
      const shotName = walkShotFor(run, stage.step);
      const suspectedFile = STEP_SUSPECTED_FILES[stage.step];

      let observed: string;
      let actionFailed = false;
      try {
        observed = await stage.act(ctx);
      } catch (error) {
        actionFailed = true;
        observed = `Failed: ${errorMessage(error)}`;
      }

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
          defects.push(
            ...defectsFromChecks(
              stage.step,
              checkStepSnapshot(stage.step, snapshot, {
                letterText: LETTER_TEXT,
              }),
            ),
          );
          // Q1.2 layout rules, read on every step change. A rule whose boxes are not
          // on the page at this stage is not run, rather than passed on a guess.
          const boxes = await readStepBoxes(page);
          const layoutChecks: StepCheck[] = [];
          if (boxes.heading && boxes.topBar) {
            layoutChecks.push(
              checkStepHeadingClearOfTopBar(boxes.heading, boxes.topBar),
            );
          }
          if (stage.step === "wait" && boxes.ghost && boxes.keep) {
            layoutChecks.push(checkGhostClearOfKeep(boxes.ghost, boxes.keep));
          }
          defects.push(...defectsFromChecks(stage.step, layoutChecks));
          if (stage.step === "wait") {
            waitSeal = await readSealMark(page, false);
          }
          if (stage.step === "marks") {
            // Q1.3: the seal at Break the seal matches the one on the Wait step.
            // U8: the seal is at least the minimum size at this width.
            const breakSeal = await readSealMark(page, true);
            const box = await readBreakSealBox(page);
            defects.push(
              ...defectsFromChecks("marks", [
                checkSealMarks(waitSeal ?? NO_SEAL, breakSeal),
                checkBreakSealSize(
                  box,
                  { width, height },
                  breakSealMinWidth(width),
                ),
              ]),
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

      // Checks a stage collected while it ran (the seal and tamper passkey counts).
      defects.push(...defectsFromChecks(stage.step, stage.checks ?? []));

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
          observed += ` ${await stage.afterShot(ctx)}`;
        } catch (error) {
          defects.push({
            step: stage.step,
            expected: `The ${stage.step} stage's follow-on action completes and the next stage is reached.`,
            observed: `Failed: ${errorMessage(error)}`,
            suspectedFile,
          });
        }
      }

      const blocked = actionFailed ? FIVE_STAGE_BLOCKED[stage.step] : undefined;
      rows.push({
        result: recordStepResult({
          step: stage.step,
          observation: observed,
          shots: shot ? [shot] : [],
          defects,
        }),
        shot,
        blocked,
      });
      if (actionFailed && !blocked) break;
    }
    // Q1.2: the whole run makes at most two passkey prompts.
    const lastStep = stages[stages.length - 1]?.step ?? WALK_STEP_NAMES[0];
    passkeyDefects = defectsFromChecks(lastStep, [
      checkPasskeyTotal(await readPasskeyCounts(page)),
    ]);
    await context.close();
  } finally {
    await browser.close();
  }
  return { rows, letterPath: letter.path, passkeyDefects };
}

/** One line per step, then one line per defect. Quoted by the owner in the QA verdict. */
function formatStageRows(rows: readonly StageRow[]): string {
  return rows
    .flatMap((row) => {
      const r = row.result;
      const label = row.blocked
        ? `EXPECTED-BLOCKED (task ${row.blocked.task})`
        : r.pass
          ? "PASS"
          : "FAIL";
      const lines = [
        `${r.step}: ${label}. ${r.observation}` +
          (row.shot ? ` ${RECORD_SHOT_PREFIX}${row.shot}` : ""),
      ];
      for (const defect of r.defects) {
        lines.push(
          `  Defect. Expected: ${defect.expected} Observed: ${defect.observed} Suspected file: ${defect.suspectedFile}`,
        );
      }
      return lines;
    })
    .join("\n");
}

/** The Step_Shot names one run writes for the given steps. */
/** The Step_Shot name for one step of a run. The keyboard run adds a `-keyboard` suffix. */
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

function runShotNames(run: WalkRun, steps: readonly WalkStepName[]): string[] {
  return steps.map((step) => walkShotFor(run, step));
}

/**
 * Which expected Step_Shots this run wrote. Missing ones print `FAIL missing Step_Shot`.
 * Only files with an mtime at or after `runStartMs` count, so a file from the other
 * variant cannot satisfy the check. Each call site runs it straight after its own
 * browser run and before the next run starts.
 */
function shotReport(expected: readonly string[], runStartMs: number) {
  const files: ShotFile[] = expected.flatMap((name) => {
    const file = path.join(LIVE_WALK_SHOTS, name);
    return existsSync(file) ? [{ name, mtimeMs: statSync(file).mtimeMs }] : [];
  });
  return checkRunShots(expected, shotsWrittenSince(files, runStartMs));
}

/** The recall stage: answer every question in turn, then go on to `marks`. Returns the count answered. */
async function answerEveryQuestion(c: WalkContext): Promise<number> {
  const recall = c.page.locator('[data-ceremony="recall"]');
  let answered = 0;
  for (let guard = 0; guard < 12; guard += 1) {
    if ((await currentStage(c.page)) !== "recall") break;
    const field = recall
      .locator('textarea, input[type="text"], input[type="number"]')
      .first();
    if ((await field.count()) > 0) {
      await field.fill(`Walk answer ${answered + 1}`);
    } else {
      // A scale control. The Motion_Control is excluded: it is not an answer.
      const control = recall
        .locator('button[aria-label]:not([aria-label*="motion" i])')
        .first();
      if ((await control.count()) === 0) {
        throw new Error("No recall answer control found on the Testify stage.");
      }
      await control.click();
    }
    answered += 1;
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
  return answered;
}

/**
 * Presses the Seal step's envelope in the way the run calls for (Q1.3). The press
 * is the native button `PressEnvelope` renders (`[data-press-mode="write"]`, named
 * PRESS_COPY.name). Touch and mouse holds last SEAL_HOLD_WAIT_MS, so the press
 * passes its threshold before the release.
 */
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
 * Stages Write to Testify. The write-receipts stage picks one figure when `run.figure`
 * is true (the one-figure variant); otherwise it opens the receipts and adds none.
 */
function fiveStageActions(run: WalkRun): readonly StageAction[] {
  const figure = run.figure;
  const sealChecks: StepCheck[] = [];
  return [
    {
      step: "write",
      act: async (c) => {
        await c.page.goto(`${BASE_URL}/demo/live`);
        const write = c.page.locator('[data-live-step="write"]');
        await write.waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        await write.locator('button[aria-pressed="false"]').first().click();
        await write.locator("textarea").first().fill(LETTER_TEXT);
        await write
          .getByLabel("Question 1", { exact: true })
          .fill(WALK_QUESTION);
        const removers = write.getByRole("button", {
          name: /^Remove question \d+$/,
        });
        if ((await removers.count()) < 2) {
          await write.getByRole("button", { name: /^Add a question$/ }).click();
        }
        const before = await removers.count();
        await removers.last().click();
        return `Occasion chosen, letter typed, question 1 edited, one question removed (${before} before).`;
      },
    },
    {
      step: "write-receipts",
      act: async (c) => {
        await c.page
          .getByText("Add a receipt", { exact: true })
          .first()
          .click();
        const open = await c.page
          .locator("details[data-receipts-disclosure]")
          .first()
          .evaluate((el) => (el as HTMLDetailsElement).open);
        if (!open) {
          throw new Error("The Receipts_Disclosure did not open.");
        }
        if (!figure) {
          // Check the rows rather than claim it: the own-number inputs inside
          // the open disclosure must all be empty. Only SelfReportedRows sets
          // data-user-content inside the disclosure, so the selector is exact.
          const typed = await c.page
            .locator("[data-receipts-disclosure] input[data-user-content]")
            .evaluateAll((inputs) =>
              inputs.map((input) => (input as HTMLInputElement).value),
            );
          const check = checkOwnNumberRowsBlank(typed);
          if (!check.ok) throw new Error(check.message);
          return `Receipts_Disclosure opened. ${check.message.replace(/^PASS /, "")}.`;
        }
        return `Receipts_Disclosure opened. Figure selected: ${await tickOneFigure(c.page)}.`;
      },
    },
    {
      step: "seal",
      act: async (c) => {
        // Write and receipts share one stepper step. Next moves the stepper to
        // Press the seal, where the Backup_Choice and the press appear.
        const backupChoice = c.page.locator("[data-backup-choice]");
        if (!(await backupChoice.isVisible())) {
          await c.page
            .getByRole("button", { name: LIVE_COPY.nextButton, exact: true })
            .click();
        }
        // Skip it is the explicit confirmation that unlocks the press (P7, P1.5).
        await c.page
          .getByRole("radio", { name: LIVE_COPY.backupChoiceSkip, exact: true })
          .check();
        // Q1.2: on the Seal step the Press_Envelope is the only orange button. Read
        // before the press, while every button of the step is still on the page.
        sealChecks.push(
          checkSealOrangeButtons(await readOrangeButtons(c.page)),
        );
        if (
          sealPressInput({
            width: run.size.width,
            reduced: run.reduced,
            keyboard: run.keyboard,
          }) === "hold"
        ) {
          await pressSealEarly(c);
          // Q1.2: an early release makes no prompt and stores no credential.
          // Early release is checked only on the desktop mouse-hold run, because
          // sealPressInput returns "hold" only at 1440 without reduced motion.
          // Touch, click and keyboard runs do not exercise early release.
          const early = await readPasskeyCounts(c.page);
          const { credentials } = (await c.cdp.send("WebAuthn.getCredentials", {
            authenticatorId: c.authenticatorId,
          })) as { credentials: unknown[] };
          sealChecks.push(checkEarlyRelease(early, credentials.length));
        }
        await pressSealEnvelope(c, run);
        // Q1.2: a second quick press while the passkey prompt is open adds no
        // prompt. Read the total on either side of that press.
        const beforeQuick = await readPasskeyCounts(c.page);
        await c.page
          .getByRole("button", { name: PRESS_COPY.name, exact: true })
          .click();
        const afterQuick = await readPasskeyCounts(c.page);
        sealChecks.push(
          checkQuickPressAddsNone(beforeQuick.total, afterQuick.total),
        );
        await c.page
          .locator('[data-live-step="created"]')
          .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        // Q1.2: a release past the hold makes exactly one create prompt.
        const afterRelease = await readPasskeyCounts(c.page);
        sealChecks.push(
          checkPasskeyCount(afterRelease, { create: 1 }, "seal release"),
        );
        // The passkey is created. The Setting_State is one plain press, with no hold.
        await c.page.locator('[data-press-mode="setting"]').click();
        await c.page
          .locator('[data-live-step="sealed"]')
          .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        // Q1.2: the Setting_State press makes exactly one get prompt.
        const afterSetting = await readPasskeyCounts(c.page);
        sealChecks.push(
          checkPasskeyCount(
            passkeyDelta(afterRelease, afterSetting),
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
      checks: sealChecks,
    },
    {
      step: "wait",
      act: async (c) => {
        await c.page.waitForTimeout(LOCK_WAIT_MS);
        return `Waited ${LOCK_WAIT_MS / 1000} seconds on the sealed page.`;
      },
    },
    {
      step: "unlock",
      act: async (c) => {
        await openLetterAndUnlock(c, /unlock with your passkey/i);
        await c.page
          .locator('[data-ceremony="recall"]')
          .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        return "Unlocked with the passkey. Recall stage shown.";
      },
    },
    {
      step: "testify",
      act: async (c) => {
        const answered = await answerEveryQuestion(c);
        return `Answered ${answered} recall question(s).`;
      },
    },
  ];
}

async function openLetterAndUnlock(
  c: WalkContext,
  label: RegExp,
): Promise<void> {
  const goTo = c.page
    .getByRole("link", { name: /go to your letter/i })
    .or(c.page.getByRole("button", { name: /go to your letter/i }));
  await goTo.first().click();
  await c.page.waitForURL(/\/l\//, { timeout: STEP_TIMEOUT_MS });
  c.letter.path = new URL(c.page.url()).pathname;
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

/**
 * Stages Break the seal through Close. The marks Step_Shot and its Q1.6 checks
 * run while `data-ceremony` is `marks`; the break is a separate action after them.
 */
function remainingStageActions(method: BreakMethod): readonly StageAction[] {
  return [
    {
      step: "marks",
      act: async (c) => {
        await c.page
          .locator('[data-ceremony="marks"]')
          .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        return "Break the seal stage shown, seal not yet touched.";
      },
      afterShot: (c) => breakSeal(c, method),
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
      act: async (c) => {
        if ((await currentStage(c.page)) === "letter") {
          // The letter stage's button is REVEAL_COPY.stage2Next, "See the receipts"
          // (reveal/copy.ts, rendered by Reveal.tsx). /see the receipts/i matches it.
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

describe.skipIf(!walkEnabled(process.env))(
  "live walk: first five stages",
  () => {
    // Every WALK_MATRIX entry: each width, no figure or one figure, with and without reduced motion.
    it.each(WALK_MATRIX.map((entry) => [entry.id, entry] as const))(
      "walks Write to Testify and saves Step_Shots at %s",
      async (_id, entry) => {
        const matrix = matrixRun(entry);
        const run: WalkRun = {
          size: matrix.size,
          reduced: matrix.reduced,
          figure: matrix.figure,
          method: "hold",
          keyboard: false,
        };
        const stages = fiveStageActions(run);
        const runStartMs = Date.now();
        const { rows } = await runWalk(run, stages);
        const record = formatStageRows(rows);
        console.log(record);

        const expected = matrixShotNames(
          entry,
          stages.map((stage) => stage.step),
        );
        const shots = shotReport(expected, runStartMs);
        console.log(shots.lines.join("\n"));
        const unnamed = shotsMissingFromRecord(record, expected);

        const failed = rows.filter((row) => !row.result.pass && !row.blocked);
        expect(
          failed.map((row) => `${row.result.step}: ${row.result.observation}`),
        ).toEqual([]);
        expect(shots.missing).toEqual([]);
        expect(unnamed).toEqual([]);
      },
      VIEWPORT_TIMEOUT_MS,
    );
  },
);

describe.skipIf(!walkEnabled(process.env))(
  "live walk: Break the seal through Close",
  () => {
    // Each width, with and without reduced motion, with and without one figure,
    // with each way of breaking the seal (Q1.4, Q1.2).
    const runs: WalkRun[] = WALK_SIZES.flatMap((size) =>
      [false, true].flatMap((reduced) =>
        [false, true].flatMap((figure) =>
          BREAK_METHODS.map((method) => ({
            size,
            reduced,
            figure,
            method,
            keyboard: false,
          })),
        ),
      ),
    );
    // Q1.3: one 1440 run presses the seal with Space and gets the same prompt checks.
    runs.push({
      size: {
        width: KEYBOARD_MATRIX_ENTRY.width,
        height: KEYBOARD_MATRIX_ENTRY.height,
      },
      reduced: false,
      figure: false,
      method: "hold",
      keyboard: true,
    });

    it.each(
      runs.map((run) => {
        const motion = run.reduced ? "reduced motion" : "motion on";
        const figures = run.figure ? "one figure" : "no figure";
        const label = `${run.size.width}x${run.size.height}, ${motion}, ${figures}, break with ${run.method}${run.keyboard ? ", Space key" : ""}`;
        return [label, run] as const;
      }),
    )(
      "walks the whole flow: %s",
      async (_label, run) => {
        const stages = [
          ...fiveStageActions(run),
          ...remainingStageActions(run.method),
        ];
        const runStartMs = Date.now();
        const { rows, letterPath, passkeyDefects } = await runWalk(run, stages);
        const pageChecks = await checkSealPages(run.size, letterPath);
        console.log(pageChecks.map((check) => check.message).join("\n"));
        expect(
          pageChecks.filter((check) => !check.ok).map((check) => check.message),
        ).toEqual([]);
        const record = formatStageRows(rows);
        console.log(record);

        const expected = runShotNames(
          run,
          stages.map((stage) => stage.step),
        );
        const shots = shotReport(expected, runStartMs);
        console.log(shots.lines.join("\n"));
        const unnamed = shotsMissingFromRecord(record, expected);

        const failed = rows.filter((row) => !row.result.pass && !row.blocked);
        expect(
          failed.map((row) => `${row.result.step}: ${row.result.observation}`),
        ).toEqual([]);
        expect(shots.missing).toEqual([]);
        expect(unnamed).toEqual([]);
        expect(passkeyDefects.map((defect) => defect.observed)).toEqual([]);
      },
      VIEWPORT_TIMEOUT_MS,
    );
  },
);

/**
 * The seal the page draws: the first `svg` with a `data-seal-hash`. At Break the
 * seal the search is limited to `[data-seal-target]`.
 */
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

/** Q1.4 pages: each one must show its seal in the server HTML with JavaScript off. */
const NO_JS_PATHS = ["/", "/demo", `/demo/personas/${PERSONA_KEY}`] as const;

/**
 * Q1.4 and U9. Loads `/`, `/demo`, the persona page and the walk's `/l/<id>` with
 * JavaScript disabled, then checks the seal markers in the HTML. Then, with
 * JavaScript on, measures the persona seals on `/demo` (U9). Runs after the
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
 * The persona tamper stage (A1). Opens the persona, moves through the Read step
 * (answering questions and breaking the seal on the way), presses the
 * Tamper_Control and waits for its result. It must make no passkey prompt.
 */
function tamperStage(): StageAction {
  const tamperChecks: StepCheck[] = [];
  return {
    step: "tamper",
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
      let reached = false;
      for (let guard = 0; guard < 12; guard += 1) {
        if ((await tamper.count()) > 0 && (await tamper.first().isVisible())) {
          reached = true;
          break;
        }
        const stage = await currentStage(c.page);
        if (stage === "recall") {
          await answerEveryQuestion(c);
        } else if (stage === "marks") {
          await breakSeal(c, "button");
        } else if ((await advance.count()) > 0) {
          await advance.click();
          await c.page.waitForTimeout(300);
        } else {
          await c.page.waitForTimeout(300);
        }
      }
      if (!reached) {
        throw new Error(
          "The Tamper_Control was not reached on the persona page.",
        );
      }
      const noPasskey = checkTamperRunNoPasskey(
        await readPasskeyCounts(c.page),
      );
      if (!noPasskey.ok) throw new Error(noPasskey.message);
      await tamper.first().click();
      await c.page
        .locator("[data-tamper-result]")
        .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
      // Q1.2: the press itself must not prompt, so the count is read again after it.
      tamperChecks.push(
        checkTamperRunNoPasskey(await readPasskeyCounts(c.page)),
      );
      return `Tamper_Control opened on the Read step and its result shown. ${noPasskey.message.replace(/^PASS /, "")}.`;
    },
    checks: tamperChecks,
  };
}

describe.skipIf(!walkEnabled(process.env))("live walk: persona tamper", () => {
  // Each width, with and without reduced motion. No passkey is made (A1).
  it.each(TAMPER_MATRIX.map((entry) => [entry.id, entry] as const))(
    "opens the Tamper_Control on the persona Read step at %s",
    async (_id, entry) => {
      const run: WalkRun = {
        size: { width: entry.width, height: entry.height },
        reduced: entry.reduced,
        figure: false,
        method: "hold",
        keyboard: false,
      };
      const runStartMs = Date.now();
      const { rows, passkeyDefects } = await runWalk(run, [tamperStage()]);
      const record = formatStageRows(rows);
      console.log(record);

      const expected = tamperShotNames(entry);
      const shots = shotReport(expected, runStartMs);
      console.log(shots.lines.join("\n"));
      const unnamed = shotsMissingFromRecord(record, expected);

      const failed = rows.filter((row) => !row.result.pass && !row.blocked);
      expect(
        failed.map((row) => `${row.result.step}: ${row.result.observation}`),
      ).toEqual([]);
      expect(shots.missing).toEqual([]);
      expect(unnamed).toEqual([]);
      expect(passkeyDefects.map((defect) => defect.observed)).toEqual([]);
    },
    VIEWPORT_TIMEOUT_MS,
  );
});
