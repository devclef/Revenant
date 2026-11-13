/**
 * Live_Walk (Q1, Q2). Skipped unless WALK=1.
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
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

import { chromium, type BrowserContext, type Page } from "playwright-core";
import { describe, expect, it } from "vitest";

import { LIVE_COPY } from "../../components/live/copy";

import {
  BREAK_METHODS,
  FULL_PAGE_STEPS,
  MOTION_CONTROL_SELECTOR,
  STEP_SUSPECTED_FILES,
  WALK_SIZES,
  checkStepSnapshot,
  defectsFromChecks,
  recordStepResult,
  reportMissingShots,
  walkShotName,
  type BreakMethod,
  type ClippedSample,
  type ContrastSample,
  type PageSnapshot,
  type WalkDefect,
  type WalkStepName,
  type WalkStepResult,
} from "./live-walk-helpers";
import {
  WALK_MATRIX,
  matrixRun,
  matrixShotNames,
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
};

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
  it.each(WALK_MATRIX.map((entry) => [entry.id, entry] as const))(
    "plans every Step_Shot for %s",
    (_id, entry) => {
      const names = matrixShotNames(entry);
      expect(names).toHaveLength(10);
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
 * by `walkShotName`). The walk stops at the first stage with a defect. Missing
 * Step_Shots print `FAIL missing Step_Shot <name>`.
 */

/** Folder for the Step_Shots of the walk. Git-ignored. */
const LIVE_WALK_SHOTS = path.resolve(QA_SHOTS_ROOT, "live-walk");
/** How long the screen must hold still before a Step_Shot is taken. */
const SETTLE_MS = 300;
/** How long the seal is held down for the press-and-hold break. */
const HOLD_MS = 2_500;

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
 * The Skip_Link is not part of the wait. Decision: its visibility stays the
 * shared rule `skipLinkVisible(showAll, broken)` in ceremony/seal/skip-link.ts
 * (shown when showAll is set and the seal is not broken). The walk does not
 * change that rule and does not wait for the link to appear. The "skip" break
 * method clicks it only after the marks Step_Shot has been saved.
 */
async function waitForStable(page: Page): Promise<void> {
  const deadline = Date.now() + STEP_TIMEOUT_MS;
  let last = "";
  let since = Date.now();
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
      return `${stage}|${running}`;
    });
    if (state !== last) {
      last = state;
      since = Date.now();
    } else if (Date.now() - since >= SETTLE_MS) {
      return;
    }
    await page.waitForTimeout(50);
  }
  throw new Error(
    `The screen did not settle within ${STEP_TIMEOUT_MS} ms (last state ${last}).`,
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
 * Run stages in order in one browser session. Each stage: act, settle, check
 * (Q1.6), record (Q1.5), save its Step_Shot (Q2.1, Q2.2). Stops at the first
 * stage with a defect or an action that threw.
 */
async function runWalk(
  run: WalkRun,
  stages: readonly StageAction[],
): Promise<StageRow[]> {
  mkdirSync(LIVE_WALK_SHOTS, { recursive: true });
  const rows: StageRow[] = [];
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
    };
    let seen = 0;

    for (const stage of stages) {
      const shotName = walkShotName({
        step: stage.step,
        width,
        height,
        reduced: run.reduced,
        method: run.method,
      });
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

      // The follow-on action runs only after the stage has been checked and shot.
      if (stage.afterShot && !actionFailed && defects.length === 0) {
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
      if (defects.length > 0 && !blocked) break;
    }
    await context.close();
  } finally {
    await browser.close();
  }
  return rows;
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
          (row.shot ? ` Shot: qa-shots/live-walk/${row.shot}` : ""),
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
function runShotNames(run: WalkRun, steps: readonly WalkStepName[]): string[] {
  return steps.map((step) =>
    walkShotName({
      step,
      width: run.size.width,
      height: run.size.height,
      reduced: run.reduced,
      method: run.method,
    }),
  );
}

/** Which expected Step_Shots exist. Missing ones print `FAIL missing Step_Shot`. */
function shotReport(expected: readonly string[]) {
  const present = expected.filter((name) =>
    existsSync(path.join(LIVE_WALK_SHOTS, name)),
  );
  return reportMissingShots(expected, present);
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
 * Stages Write to Testify. The write-receipts stage picks one figure when `figure`
 * is true (the one-figure variant); otherwise it opens the receipts and adds none.
 */
function fiveStageActions(figure: boolean): readonly StageAction[] {
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
          .getByText("Add a receipt", { exact: true })
          .first()
          .evaluate((el) => el.closest("details")?.open ?? false);
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
          const filled = typed.filter((value) => value.trim() !== "");
          if (filled.length > 0) {
            throw new Error(
              `${filled.length} own-number row input(s) hold text, so the rows are not blank.`,
            );
          }
          // The walk adds no own-number row, so zero inputs is the normal state.
          // The message reports the count it saw and never claims rows it did not find.
          return typed.length === 0
            ? "Receipts_Disclosure opened. No own-number rows added."
            : `Receipts_Disclosure opened. Own-number rows blank (${typed.length} input(s), all empty).`;
        }
        return `Receipts_Disclosure opened. Figure selected: ${await tickOneFigure(c.page)}.`;
      },
    },
    {
      step: "seal",
      act: async (c) => {
        await c.page.getByRole("checkbox", { name: /lost|passkey/i }).check();
        // The live button is LIVE_COPY.createButton (WriteForm.tsx), not the
        // older "create your passkey" wording.
        await c.page
          .getByRole("button", { name: LIVE_COPY.createButton })
          .click();
        await c.page
          .locator('[data-live-step="created"]')
          .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        await c.page
          .getByRole("button", { name: /confirm your passkey/i })
          .click();
        await c.page
          .locator('[data-live-step="sealed"]')
          .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
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
        };
        const stages = fiveStageActions(run.figure);
        const rows = await runWalk(run, stages);
        console.log(formatStageRows(rows));

        const shots = shotReport(
          matrixShotNames(
            entry,
            stages.map((stage) => stage.step),
          ),
        );
        console.log(shots.lines.join("\n"));

        const failed = rows.filter((row) => !row.result.pass && !row.blocked);
        expect(
          failed.map((row) => `${row.result.step}: ${row.result.observation}`),
        ).toEqual([]);
        expect(shots.missing).toEqual([]);
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
          BREAK_METHODS.map((method) => ({ size, reduced, figure, method })),
        ),
      ),
    );

    it.each(
      runs.map((run) => {
        const motion = run.reduced ? "reduced motion" : "motion on";
        const figures = run.figure ? "one figure" : "no figure";
        const label = `${run.size.width}x${run.size.height}, ${motion}, ${figures}, break with ${run.method}`;
        return [label, run] as const;
      }),
    )(
      "walks the whole flow: %s",
      async (_label, run) => {
        const stages = [
          ...fiveStageActions(run.figure),
          ...remainingStageActions(run.method),
        ];
        const rows = await runWalk(run, stages);
        console.log(formatStageRows(rows));

        const shots = shotReport(
          runShotNames(
            run,
            stages.map((stage) => stage.step),
          ),
        );
        console.log(shots.lines.join("\n"));

        const failed = rows.filter((row) => !row.result.pass && !row.blocked);
        expect(
          failed.map((row) => `${row.result.step}: ${row.result.observation}`),
        ).toEqual([]);
        expect(shots.missing).toEqual([]);
      },
      VIEWPORT_TIMEOUT_MS,
    );
  },
);
