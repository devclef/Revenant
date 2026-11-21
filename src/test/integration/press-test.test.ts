/**
 * Press_Test (spec 16, Requirements 1.11, 1.12 and 17.2). Skipped unless WALK=1.
 *
 * Runs against a local production build, like the Live_Walk, in headless
 * Chromium. On the Write desk of /demo/live it types a letter and answers
 * questions, then presses each control in PRESS_TARGETS with a real mouse
 * hold (down, 600 ms, up) and checks that scrollY is the same at pointer
 * down and pointer up. It then folds the letter: by mouse hold at both sizes
 * and Calm states, by touch tap at 390 x 844, and by Tab and Enter at 1440 x 900.
 * After each fold it checks that "Press the seal" is the current step within
 * 2,000 ms.
 *
 * Unlike the Live_Walk, a product failure fails this test. The rules are in
 * `press-test-helpers.ts`. Every failing check is printed and then asserted.
 *
 * How to run by hand:
 *   WALK=1 RP_ID=localhost APP_ORIGIN=http://localhost:3000 \
 *     npx vitest run src/test/integration/press-test.test.ts
 * With the app running at WALK_BASE_URL on a production build.
 */
import { chromium, type Locator, type Page } from "playwright-core";
import { describe, expect, it } from "vitest";

import { DESK_COPY } from "../../components/live/desk/copy";
import { LIVE_COPY } from "../../components/live/copy";

import { PASSKEY_INIT_SCRIPT, WALK_BASE_URL } from "./live-walk-helpers";
import { walkEnabled } from "./live-walk-matrix";
import {
  CALM_STATES,
  PRESS_HOLD_MS,
  PRESS_SIZES,
  STEP_CHANGE_BUDGET_MS,
  PRESS_STEP_PATTERN,
  calmToggleNeeded,
  checkPressScroll,
  checkPressStepChange,
  pressRunLabel,
  type PressCheck,
  type PressSize,
  type PressTargetId,
} from "./press-test-helpers";

/** Text typed as the letter and as each answer. */
const PRESS_LETTER =
  "Press test letter: I will check the price of fuel next autumn.";
const PRESS_ANSWER = "Press test answer.";
const PRESS_QUESTION = "What did you hope for the year ahead?";

/** Whole-run budget for one Press_Test run. */
const RUN_TIMEOUT_MS = 5 * 60_000;
/** How long to wait for a control to be reachable before the press is reported as failing. */
const TARGET_TIMEOUT_MS = 5_000;

/** How the Fold_Button is pressed in a run. */
type FoldInput = "hold" | "touch" | "keyboard";

type PressRun = {
  size: PressSize;
  calm: boolean;
  fold: FoldInput;
};

/**
 * The runs (Requirements 1.11 and 1.12): each size with Calm on and off, a
 * touch tap of the Fold_Button at 390 x 844, and a Tab and Enter of the
 * Fold_Button at 1440 x 900.
 */
const PRESS_RUNS: readonly PressRun[] = [
  ...PRESS_SIZES.flatMap((size) =>
    CALM_STATES.map((calm) => ({ size, calm, fold: "hold" as const })),
  ),
  { size: PRESS_SIZES[1], calm: false, fold: "touch" },
  { size: PRESS_SIZES[0], calm: false, fold: "keyboard" },
];

function runTitle(run: PressRun): string {
  const extra =
    run.fold === "touch"
      ? "fold by touch tap"
      : run.fold === "keyboard"
        ? "fold by Tab and Enter"
        : undefined;
  return pressRunLabel(run.size, run.calm, extra);
}

/**
 * Records `window.scrollY` inside the press's own down and up events
 * (pointerdown and pointerup for mouse and touch, keydown and keyup for the
 * keyboard). The listeners are on `window` in the capture phase, so they run
 * before any handler of the page. Design section 2 asks for the up read "in the
 * same task, before the next frame", and Requirement 1.2 ends the check at
 * pointer up, before the Step_Track scroll of the step change. A read with
 * `page.evaluate` after `mouse.up()` returns comes later than that: the click
 * has run and a frame may have passed. The up read also ends at the press's
 * `click`, whichever comes first: Enter activates a button on key down, so for
 * the keyboard the step change (and the Step_Track scroll a frame later) comes
 * before key up.
 */
const PRESS_SCROLL_RECORDER = `(() => {
  const rec = { down: null, up: null };
  window.__pressScroll = rec;
  const onDown = () => {
    if (rec.down === null) rec.down = window.scrollY;
  };
  const onUp = () => {
    if (rec.down !== null && rec.up === null) rec.up = window.scrollY;
  };
  for (const type of ["pointerdown", "keydown"]) {
    window.addEventListener(type, onDown, true);
  }
  for (const type of ["pointerup", "keyup", "click"]) {
    window.addEventListener(type, onUp, true);
  }
})();`;

type PressScroll = { down: number | null; up: number | null };

/** Forget the last press, so the next down and up events are recorded. */
async function resetPressScroll(page: Page): Promise<void> {
  await page.evaluate(() => {
    const rec = (window as unknown as { __pressScroll: PressScroll })
      .__pressScroll;
    rec.down = null;
    rec.up = null;
  });
}

/** scrollY as read in the press's down and up events. */
async function readPressScroll(
  page: Page,
  name: string,
): Promise<{ before: number; after: number }> {
  const rec = await page.evaluate(
    () => (window as unknown as { __pressScroll: PressScroll }).__pressScroll,
  );
  if (rec.down === null || rec.up === null) {
    throw new Error(
      `no ${rec.down === null ? "down" : "up"} event reached the page for ${name}`,
    );
  }
  return { before: rec.down, after: rec.up };
}

/** Bring a control into view, or fail with the control's name. */
async function reach(locator: Locator, name: string): Promise<void> {
  await locator.first().scrollIntoViewIfNeeded({ timeout: TARGET_TIMEOUT_MS });
  const box = await locator.first().boundingBox();
  if (!box) {
    throw new Error(`${name} has no size on screen`);
  }
}

/** Centre of the first match, after it has been brought into view. */
async function centre(
  locator: Locator,
  name: string,
): Promise<{ x: number; y: number }> {
  await reach(locator, name);
  const box = await locator.first().boundingBox();
  if (!box) throw new Error(`${name} has no size on screen`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * A real mouse press: down, a hold of PRESS_HOLD_MS, up. Returns scrollY at
 * pointer down and at pointer up.
 */
async function holdPress(
  page: Page,
  locator: Locator,
  name: string,
): Promise<{ before: number; after: number }> {
  const { x, y } = await centre(locator, name);
  await page.mouse.move(x, y);
  await resetPressScroll(page);
  await page.mouse.down();
  await page.waitForTimeout(PRESS_HOLD_MS);
  await page.mouse.up();
  return readPressScroll(page, name);
}

/** Find the Step_Indicator's current item text, or null. */
async function currentStepText(page: Page): Promise<string | null> {
  return page.evaluate(
    () =>
      document
        .querySelector('[data-step-indicator] [aria-current="step"]')
        ?.textContent?.trim() ?? null,
  );
}

/**
 * After pointer up (or the key or tap that folds), poll until "Press the seal"
 * is current, for STEP_CHANGE_BUDGET_MS. Returns the check for the spec.
 */
async function measureStepChange(
  page: Page,
  startedAt: number,
): Promise<PressCheck> {
  let current: string | null = null;
  let elapsed: number | null = null;
  const deadline = startedAt + STEP_CHANGE_BUDGET_MS;
  while (Date.now() <= deadline) {
    current = await currentStepText(page);
    if (current !== null && PRESS_STEP_PATTERN.test(current)) {
      elapsed = Date.now() - startedAt;
      break;
    }
    await page.waitForTimeout(50);
  }
  if (elapsed === null) {
    current = current ?? (await currentStepText(page));
  }
  return checkPressStepChange({ currentStep: current, elapsedMs: elapsed });
}

/** Choose the Calm state the run needs, by reading the Calm control's label. */
async function setCalm(page: Page, wantCalm: boolean): Promise<void> {
  const control = page.locator('[data-topbar-slot="calm"]').first();
  const label = (await control.getAttribute("aria-label")) ?? "";
  if (calmToggleNeeded(label, wantCalm)) {
    await control.click();
  }
}

/** Type the letter and answer the desk's questions. Shared by every run. */
async function typeLetterAndAnswers(page: Page): Promise<void> {
  await page.locator("#live-letter").fill(PRESS_LETTER);
}

/** Fill the question text of the last row, then every answer on the desk. */
async function writeQuestionAndAnswers(page: Page): Promise<void> {
  const rows = page.locator("[data-question-row]");
  const last = rows.last();
  const questionField = last.locator("textarea:not([data-answer-input])");
  if (
    (await questionField.count()) > 0 &&
    (await questionField.inputValue()) === ""
  ) {
    await questionField.fill(PRESS_QUESTION);
  }
  const answers = page.locator("[data-answer-input]");
  const count = await answers.count();
  for (let i = 0; i < count; i += 1) {
    if ((await answers.nth(i).inputValue()) === "") {
      await answers.nth(i).fill(PRESS_ANSWER);
    }
  }
}

/** Open the receipt panel at the phone width, where it is a details element. */
async function openReceipts(page: Page): Promise<void> {
  const panel = page.locator("[data-receipt-panel]").first();
  if ((await panel.count()) === 0) return;
  const isDetails = await panel.evaluate((el) => el.tagName === "DETAILS");
  if (!isDetails) return;
  const open = await panel.evaluate((el) => (el as HTMLDetailsElement).open);
  if (!open) await panel.locator("summary").first().click();
}

/**
 * The controls of the Write step, in the order the run presses them. Each
 * target's locator is looked up when the press happens.
 */
function targetLocator(
  page: Page,
  id: PressTargetId,
): { locator: Locator; name: string } {
  const write = page.locator('[data-live-step="write"]');
  switch (id) {
    case "occasion-pill":
      return {
        name: "the Work Occasion pill",
        locator: write.getByRole("button", {
          name: LIVE_COPY.occasionLabels.work,
          exact: true,
        }),
      };
    case "suggestion-pill":
      return {
        name: "a Suggestion_Pill",
        locator: write.getByRole("button", { name: /^Add the question:/ }),
      };
    case "write-my-own":
      return {
        name: "Write my own",
        locator: write.getByRole("button", {
          name: DESK_COPY.writeOwn,
          exact: true,
        }),
      };
    case "receipt-toggle":
      return {
        name: "the public price receipt toggle",
        locator: page.getByRole("button", {
          name: DESK_COPY.togglePublic,
          exact: true,
        }),
      };
    case "remove":
      return {
        name: "Remove on the last question",
        locator: page
          .locator("[data-question-row]")
          .last()
          .getByRole("button", { name: /^Remove/ }),
      };
    case "fold":
      return {
        name: "the Fold_Button",
        locator: page.locator("[data-fold-button]"),
      };
  }
}

/**
 * Press one non-fold target with a mouse hold and record its check. A target
 * that cannot be reached is a failing check, not a crash, so the rest of the run
 * still happens and reports.
 */
async function pressTarget(
  page: Page,
  id: PressTargetId,
  checks: PressCheck[],
): Promise<void> {
  const { locator, name } = targetLocator(page, id);
  try {
    const { before, after } = await holdPress(page, locator, name);
    checks.push(checkPressScroll({ target: name, before, after }));
  } catch (error) {
    checks.push({
      ok: false,
      message: `FAIL ${name} could not be pressed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

/**
 * Drive the Write desk to the point where the Fold_Button is pressed: type the
 * letter, press each target in order, then fill the answers. The Fold_Button
 * press itself is left to the caller.
 */
async function runDeskUpToFold(
  page: Page,
  checks: PressCheck[],
): Promise<void> {
  await typeLetterAndAnswers(page);
  await pressTarget(page, "occasion-pill", checks);
  await pressTarget(page, "write-my-own", checks);
  await writeQuestionAndAnswers(page);
  await pressTarget(page, "suggestion-pill", checks);
  await writeQuestionAndAnswers(page);
  await openReceipts(page);
  await pressTarget(page, "receipt-toggle", checks);
  await pressTarget(page, "remove", checks);
  await writeQuestionAndAnswers(page);
}

/** Fold by a mouse hold, the same way as the other targets. */
async function foldByHold(page: Page, checks: PressCheck[]): Promise<void> {
  const { locator, name } = targetLocator(page, "fold");
  try {
    const { before, after } = await holdPress(page, locator, name);
    checks.push(checkPressScroll({ target: name, before, after }));
  } catch (error) {
    checks.push({
      ok: false,
      message: `FAIL ${name} could not be pressed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

/** Fold by a touch tap at 390 x 844 (Requirement 1.12). */
async function foldByTouch(
  page: Page,
  cdpTap: (x: number, y: number) => Promise<void>,
  checks: PressCheck[],
): Promise<void> {
  const { locator, name } = targetLocator(page, "fold");
  try {
    const { x, y } = await centre(locator, name);
    await resetPressScroll(page);
    await cdpTap(x, y);
    const { before, after } = await readPressScroll(
      page,
      `${name} by touch tap`,
    );
    checks.push(
      checkPressScroll({ target: `${name} by touch tap`, before, after }),
    );
  } catch (error) {
    checks.push({
      ok: false,
      message: `FAIL ${name} could not be tapped: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

/**
 * Fold by Tab and Enter at 1440 x 900 (Requirement 1.12). Focus moves to the
 * Fold_Button with Tab, then Enter is held down and released. scrollY is read
 * at key down and at key up.
 */
async function foldByKeyboard(page: Page, checks: PressCheck[]): Promise<void> {
  const fold = page.locator("[data-fold-button]").first();
  try {
    await page.locator("[data-answer-input]").last().focus();
    for (let i = 0; i < 60; i += 1) {
      const isFold = await page.evaluate(
        () => document.activeElement?.hasAttribute("data-fold-button") ?? false,
      );
      if (isFold) break;
      await page.keyboard.press("Tab");
    }
    const focused = await fold.evaluate((el) => el === document.activeElement);
    if (!focused) {
      throw new Error("Tab did not reach the Fold_Button");
    }
    await resetPressScroll(page);
    await page.keyboard.down("Enter");
    await page.keyboard.up("Enter");
    const { before, after } = await readPressScroll(
      page,
      "the Fold_Button by Tab and Enter",
    );
    checks.push(
      checkPressScroll({
        target: "the Fold_Button by Tab and Enter",
        before,
        after,
      }),
    );
  } catch (error) {
    checks.push({
      ok: false,
      message: `FAIL the Fold_Button could not be reached and pressed by keyboard: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

/** Run one Press_Test: the desk presses, then the fold, then the step change. */
async function runPressTest(run: PressRun): Promise<PressCheck[]> {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  const checks: PressCheck[] = [];
  try {
    const context = await browser.newContext({
      viewport: run.size,
      hasTouch: run.fold === "touch",
    });
    await context.addInitScript(PASSKEY_INIT_SCRIPT);
    await context.addInitScript(PRESS_SCROLL_RECORDER);
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);

    await page.goto(`${WALK_BASE_URL}/demo/live`);
    await page
      .locator('[data-live-step="write"]')
      .waitFor({ state: "visible", timeout: 30_000 });
    await setCalm(page, run.calm);

    await runDeskUpToFold(page, checks);

    if (run.fold === "hold") {
      await foldByHold(page, checks);
    } else if (run.fold === "touch") {
      await foldByTouch(
        page,
        async (x, y) => {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ x, y }],
          });
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
          });
        },
        checks,
      );
    } else {
      await foldByKeyboard(page, checks);
    }
    // The clock starts once the fold has been released (pointer up, tap or key up).
    checks.push(await measureStepChange(page, Date.now()));
    return checks;
  } finally {
    await browser.close();
  }
}

describe.skipIf(!walkEnabled(process.env))(
  "Press_Test (spec 16, 1.11 and 1.12)",
  () => {
    it.each(PRESS_RUNS.map((run) => [runTitle(run), run] as const))(
      "presses without scrolling and folds: %s",
      async (_label, run) => {
        const checks = await runPressTest(run);
        console.log(checks.map((check) => check.message).join("\n"));
        const failed = checks
          .filter((check) => !check.ok)
          .map((check) => check.message);
        expect(failed).toEqual([]);
      },
      RUN_TIMEOUT_MS,
    );
  },
);
