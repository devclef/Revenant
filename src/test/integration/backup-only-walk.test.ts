/**
 * Part A QA walk for the backup-only seal (spec 20, task 10; design "QA browser
 * steps, Part A"). Skipped unless WALK=1 and DATABASE_URL is set, and skipped
 * per test when the app or a Chromium browser cannot be reached.
 *
 * It runs twice, once on /demo/live (demo letter) and once on /seal with
 * REAL_SEALING=on (real letter). Each check loads the page afresh, writes a
 * letter with one question and answer and folds to the Seal_Step. The QA stub
 * (`window.__qa`) refuses every passkey prompt and counts them, and it logs each
 * fetch the page makes after the stub is installed.
 *
 * The checks are:
 *   a      after Backup_Only_Start: no passkey prompt, no request to a letter route
 *   b      after "Not now": the Seal_Step heading has focus and the letter text is kept
 *   c      after a second start, the tick and "Seal with this key": no passkey prompt,
 *          and the requests are that mode's prepare and seal routes only
 *   d      the backup key card shows the key from the Backup_Fallback screen
 *   demo   the countdown ends, the letter opens with that key and reaches Testify
 *   real   the letter link shows the still-sealed state and no letter content
 *
 * Product failures fail the test, so each failing check shows its route,
 * expected and observed value.
 *
 * How to run by hand, against a production build with a database:
 *   WALK=1 DATABASE_URL=<url> RP_ID=localhost APP_ORIGIN=http://localhost:3000 \
 *     npx vitest run src/test/integration/backup-only-walk.test.ts
 * The real mode needs the app started with REAL_SEALING=on.
 */
import type { Browser, Page } from "playwright-core";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  type TestContext,
} from "vitest";

import { LIVE_COPY, REAL_COPY } from "../../components/live/copy";
import { launchWalkBrowser, WALK_BASE_URL } from "./live-walk-helpers";
import { walkEnabled } from "./live-walk-matrix";
import { PRESS_HOLD_MS } from "./press-test-helpers";

const WALK_LETTER =
  "Backup walk letter: I will check the bus fare again next autumn.";
const WALK_QUESTION =
  "What did you hope for the year ahead, the day you sealed this?";
const WALK_ANSWER =
  "Backup walk answer: a quieter year and more time outdoors.";

/** The spec 06 QA stub, installed after the page has loaded. Prompts are refused at once. */
const QA_STUB = `(() => {
  const S = (window.__qa = { log: [], creates: 0, gets: 0 });
  const refuse = () => Promise.reject(new DOMException("QA stub: no passkey prompt", "NotAllowedError"));
  navigator.credentials.create = () => { S.log.push(["create", performance.now()]); S.creates++; return refuse(); };
  navigator.credentials.get = () => { S.log.push(["get", performance.now()]); S.gets++; return refuse(); };
  const real = window.fetch;
  window.fetch = (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input), location.href).pathname;
    S.log.push(["fetch " + url, performance.now()]);
    return real(input, init);
  };
})()`;

type QaState = { creates: number; gets: number; log: string[] };

type Mode = {
  name: "demo" | "real";
  route: "/demo/live" | "/seal";
  prepare: string;
  seal: string;
  otherPrepare: string;
  otherSeal: string;
};

const MODES: readonly Mode[] = [
  {
    name: "demo",
    route: "/demo/live",
    prepare: "/api/letters/demo/prepare",
    seal: "/api/letters/demo/seal",
    otherPrepare: "/api/letters/prepare",
    otherSeal: "/api/letters/seal",
  },
  {
    name: "real",
    route: "/seal",
    prepare: "/api/letters/prepare",
    seal: "/api/letters/seal",
    otherPrepare: "/api/letters/demo/prepare",
    otherSeal: "/api/letters/demo/seal",
  },
];

const VIEWPORT = { width: 1440, height: 900 };

/** The letter routes that a seal may call. Any of them in the log is a request. */
function isLetterRequest(entry: string): boolean {
  return entry.startsWith("fetch /api/letters");
}

/** Key text as the user sees it, with spaces and hyphens removed, for comparing. */
function normaliseKey(text: string): string {
  return text.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

async function qaState(page: Page): Promise<QaState> {
  return page.evaluate(() => {
    const qa = (
      window as unknown as {
        __qa: { creates: number; gets: number; log: [string, number][] };
      }
    ).__qa;
    return {
      creates: qa.creates,
      gets: qa.gets,
      log: qa.log.map((entry) => entry[0]),
    };
  });
}

/** Open the page, write a letter with one question and answer, and fold to the Seal_Step. */
async function openSealStep(page: Page, mode: Mode): Promise<void> {
  await page.goto(`${WALK_BASE_URL}${mode.route}`);
  await page
    .locator('[data-live-step="write"]')
    .waitFor({ state: "visible", timeout: 30_000 });
  await page.evaluate(QA_STUB);

  await page.locator("#live-letter").fill(WALK_LETTER);
  const question = page
    .locator("[data-question-row]")
    .last()
    .locator("textarea:not([data-answer-input])");
  if ((await question.count()) > 0 && (await question.inputValue()) === "") {
    await question.fill(WALK_QUESTION);
  }
  const answers = page.locator("[data-answer-input]");
  for (let i = 0; i < (await answers.count()); i += 1) {
    if ((await answers.nth(i).inputValue()) === "") {
      await answers.nth(i).fill(WALK_ANSWER);
    }
  }

  // Fold with a hold on the Fold_Button, as the Press_Test does.
  const fold = page.locator("[data-fold-button]").first();
  await fold.scrollIntoViewIfNeeded();
  const box = await fold.boundingBox();
  if (!box) throw new Error("the Fold_Button has no size on screen");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(PRESS_HOLD_MS);
  await page.mouse.up();

  await page
    .locator("[data-seal-step]")
    .waitFor({ state: "visible", timeout: 10_000 });
}

async function startBackupOnly(page: Page): Promise<void> {
  await page.locator("[data-backup-only-start]").first().click();
  await page
    .locator('[data-live-fallback="backup"]')
    .waitFor({ state: "visible", timeout: 10_000 });
}

async function fallbackKey(page: Page): Promise<string> {
  const text = await page.locator("[data-live-key]").first().textContent();
  return normaliseKey(text ?? "");
}

async function sealWithKey(page: Page): Promise<void> {
  await page
    .locator('[data-live-fallback="backup"] input[type="checkbox"]')
    .first()
    .check();
  await page
    .getByRole("button", { name: LIVE_COPY.sealWithKey, exact: true })
    .first()
    .click();
  await page
    .locator("[data-live-countdown], [data-live-sealed]")
    .first()
    .waitFor({ state: "visible", timeout: 60_000 });
}

/** Open the backup key card (from the offer when it is shown) and return its key, normalised. */
async function backupCardKey(page: Page): Promise<string> {
  const offer = page.locator("[data-live-backup-offer]").first();
  if ((await offer.count()) > 0) await offer.click();
  const card = page.locator("[data-live-backup-card]").first();
  await card.waitFor({ state: "visible", timeout: 10_000 });
  return normaliseKey((await card.textContent()) ?? "");
}

/** Run one check in a fresh browser context. The context is closed afterwards. */
async function withPage<T>(
  browser: Browser,
  run: (page: Page) => Promise<T>,
): Promise<T> {
  const context = await browser.newContext({ viewport: VIEWPORT });
  try {
    return await run(await context.newPage());
  } finally {
    await context.close();
  }
}

function describeCheck(
  mode: Mode,
  id: string,
  expected: string,
  observed: string,
  ok: boolean,
): string {
  return `Part A walk | ${mode.route} | ${VIEWPORT.width}x${VIEWPORT.height} | check ${id} | expected ${expected} | observed ${observed} | ${ok ? "PASS" : "FAIL"}`;
}

const WALK_ON = walkEnabled(process.env) && Boolean(process.env.DATABASE_URL);

describe.skipIf(!WALK_ON)("Backup-only seal QA walk (spec 20, task 10)", () => {
  let browser: Browser | null = null;
  let appUp = false;

  beforeAll(async () => {
    try {
      const response = await fetch(`${WALK_BASE_URL}/api/health`);
      appUp = response.ok;
    } catch {
      appUp = false;
    }
    try {
      browser = await launchWalkBrowser();
    } catch {
      browser = null;
    }
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  /** Skip the current test when the app or the browser is missing. */
  function requireWalk(ctx: TestContext): Browser {
    if (browser === null || !appUp) ctx.skip();
    return browser as Browser;
  }

  for (const mode of MODES) {
    describe(`${mode.name} (${mode.route})`, () => {
      it(`check a: Backup_Only_Start makes no prompt and no letter request`, async (ctx) => {
        const b = requireWalk(ctx);
        await withPage(b, async (page) => {
          await openSealStep(page, mode);
          const before = await qaState(page);
          await startBackupOnly(page);
          await page.waitForTimeout(1_000);
          const after = await qaState(page);
          const newEntries = after.log.slice(before.log.length);
          const letterRequests = newEntries.filter(isLetterRequest);
          const ok =
            after.creates === 0 &&
            after.gets === 0 &&
            letterRequests.length === 0;
          const message = describeCheck(
            mode,
            "a",
            "creates 0, gets 0, no letter request after the start",
            `creates ${after.creates}, gets ${after.gets}, letter requests ${letterRequests.length}`,
            ok,
          );
          console.log(message);
          expect(ok, message).toBe(true);
        });
      }, 120_000);

      it(`check b: Not now returns to the Seal_Step with focus and keeps the letter`, async (ctx) => {
        const b = requireWalk(ctx);
        await withPage(b, async (page) => {
          await openSealStep(page, mode);
          await startBackupOnly(page);
          await page
            .getByRole("button", { name: LIVE_COPY.notNow, exact: true })
            .first()
            .click();
          await page
            .locator("[data-seal-step]")
            .waitFor({ state: "visible", timeout: 10_000 });
          await page.waitForTimeout(300);
          const focusedHeading = await page.evaluate(
            () =>
              document.activeElement?.hasAttribute("data-step-heading") ??
              false,
          );
          const letter = await page.locator("#live-letter").inputValue();
          const ok = focusedHeading && letter === WALK_LETTER;
          const message = describeCheck(
            mode,
            "b",
            "Seal_Step heading focused and the letter text kept",
            `heading focused ${focusedHeading}, letter kept ${letter === WALK_LETTER}`,
            ok,
          );
          console.log(message);
          expect(ok, message).toBe(true);
        });
      }, 120_000);

      it(`check c: the second start seals with that mode's routes only and no prompt`, async (ctx) => {
        const b = requireWalk(ctx);
        await withPage(b, async (page) => {
          await openSealStep(page, mode);
          await startBackupOnly(page);
          await page
            .getByRole("button", { name: LIVE_COPY.notNow, exact: true })
            .first()
            .click();
          await page
            .locator("[data-seal-step]")
            .waitFor({ state: "visible", timeout: 10_000 });
          const startIndex = (await qaState(page)).log.length;
          await startBackupOnly(page);
          await sealWithKey(page);
          const state = await qaState(page);
          const requests = state.log.slice(startIndex).filter(isLetterRequest);
          const usedOwnRoutes =
            requests.includes(`fetch ${mode.prepare}`) &&
            requests.includes(`fetch ${mode.seal}`);
          const usedOtherRoutes =
            requests.includes(`fetch ${mode.otherPrepare}`) ||
            requests.includes(`fetch ${mode.otherSeal}`);
          const ok =
            state.creates === 0 &&
            state.gets === 0 &&
            usedOwnRoutes &&
            !usedOtherRoutes;
          const message = describeCheck(
            mode,
            "c",
            `creates 0, gets 0, requests ${mode.prepare} and ${mode.seal} only`,
            `creates ${state.creates}, gets ${state.gets}, requests [${requests.join(", ")}]`,
            ok,
          );
          console.log(message);
          expect(ok, message).toBe(true);
        });
      }, 150_000);

      it(`check d: the backup key card shows the key from the Backup_Fallback screen`, async (ctx) => {
        const b = requireWalk(ctx);
        await withPage(b, async (page) => {
          await openSealStep(page, mode);
          await startBackupOnly(page);
          const shownKey = await fallbackKey(page);
          await sealWithKey(page);
          const cardKey = await backupCardKey(page);
          const ok = shownKey.length > 0 && cardKey.includes(shownKey);
          const message = describeCheck(
            mode,
            "d",
            "backup key card contains the key shown on the Backup_Fallback screen",
            `key length ${shownKey.length}, card contains it ${cardKey.includes(shownKey)}`,
            ok,
          );
          console.log(message);
          expect(ok, message).toBe(true);
        });
      }, 150_000);
    });
  }

  it("demo: after the countdown the letter opens with that key and reaches Testify", async (ctx) => {
    const b = requireWalk(ctx);
    const mode = MODES[0] as Mode;
    await withPage(b, async (page) => {
      await openSealStep(page, mode);
      await startBackupOnly(page);
      const key = await fallbackKey(page);
      await sealWithKey(page);
      await page
        .locator('[data-live-countdown="ready"]')
        .waitFor({ state: "visible", timeout: 90_000 });
      await page.locator("[data-live-open]").first().click();

      const field = page.locator("#unlock-backup-key");
      const asked = await field
        .waitFor({ state: "visible", timeout: 5_000 })
        .then(() => true)
        .catch(() => false);
      if (asked) {
        await field.fill(key);
        await page
          .getByRole("button", { name: LIVE_COPY.backupSubmit, exact: true })
          .first()
          .click();
      }
      const testify = page
        .locator('[data-live-stepper] [data-step="testify"]')
        .first();
      const reached = await testify
        .waitFor({ state: "visible", timeout: 30_000 })
        .then(() => true)
        .catch(() => false);
      const message = describeCheck(
        mode,
        "demo",
        "letter opens with the backup key and reaches Testify",
        `key field shown ${asked}, Testify reached ${reached}`,
        reached,
      );
      console.log(message);
      expect(reached, message).toBe(true);
    });
  }, 240_000);

  it("real: the letter link shows the still-sealed state and no letter content", async (ctx) => {
    const b = requireWalk(ctx);
    const mode = MODES[1] as Mode;
    await withPage(b, async (page) => {
      await openSealStep(page, mode);
      await startBackupOnly(page);
      await sealWithKey(page);
      await backupCardKey(page).catch(() => "");

      const bodyText = (await page.locator("body").textContent()) ?? "";
      const match = /\/l\/([A-Za-z0-9_-]+)/.exec(bodyText);
      if (match === null) {
        const message = describeCheck(
          mode,
          "real",
          "a letter link is shown after the seal",
          "no /l/ link found",
          false,
        );
        console.log(message);
        expect(false, message).toBe(true);
        return;
      }

      await page.goto(`${WALK_BASE_URL}/l/${match[1]}`);
      await page
        .getByText(REAL_COPY.stillSealed)
        .first()
        .waitFor({ state: "visible", timeout: 30_000 });
      const letterText = (await page.locator("body").textContent()) ?? "";
      const hasCountdown = /\b\d+\s*(days?|hours?|minutes?|seconds?)\b/i.test(
        letterText,
      );
      const leaksLetter =
        letterText.includes(WALK_LETTER) || letterText.includes(WALK_ANSWER);
      const ok = hasCountdown && !leaksLetter;
      const message = describeCheck(
        mode,
        "real",
        "still-sealed state with a countdown and no letter content",
        `countdown ${hasCountdown}, letter content shown ${leaksLetter}`,
        ok,
      );
      console.log(message);
      expect(ok, message).toBe(true);
    });
  }, 240_000);
});
