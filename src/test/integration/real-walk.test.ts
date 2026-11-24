/**
 * Real walk (spec 19). Skipped unless WALK=1.
 *
 * Serves the local build with REAL_SEALING=on and RP_ID=localhost against a
 * throwaway Postgres container, then drives the real sealing flow in headless
 * Chromium with a virtual passkey. The walk goes Write, then Press the seal, then
 * Keep. It also checks the landing page's real-seal link, and saves the QA_Shots
 * under `qa-shots/real-walk/`.
 *
 * How to run by hand:
 *   1. npm run build
 *   2. WALK=1 npx vitest run src/test/integration/real-walk.test.ts
 *
 * The container is removed in afterAll, even when the walk fails. Without WALK=1
 * the suite is skipped and exits 0.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

import type { Browser, Locator, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DESK_COPY } from "../../components/live/desk/copy";
import { SEAL_PRESS_HOLD_MS } from "../../components/live/press/constants";
import { PRESS_COPY } from "../../components/live/press/copy";
import { LIVE_COPY, REAL_COPY } from "../../components/live/copy";
import { LANDING_COPY } from "../../components/landing/copy";

import {
  WALK_SIZES,
  attachPrfAuthenticator,
  checkRectInside,
  databaseCommandEnv,
  launchWalkBrowser,
  parseCssColor,
  removeTestPostgres,
  startTestPostgres,
  type BoxRect,
  type TestPostgres,
} from "./live-walk-helpers";
import { walkEnabled } from "./live-walk-matrix";

/** The port the walk serves the local build on. It is not 3000, which a layout check may hold. */
const REAL_WALK_PORT = 3100;
const BASE_URL = `http://localhost:${REAL_WALK_PORT}`;

/** Folder for the QA_Shots of this walk. Git-ignored (`qa-shots/`). */
const SHOTS_DIR = path.resolve("qa-shots", "real-walk");

/** Text the walk types as the letter. The walk checks it comes back unchanged. */
const LETTER_TEXT = "Real walk letter: I will check the petrol price again next autumn.";
/** The author's question and the answer sealed with it. */
const QUESTION_TEXT = "What did you hope for the year ahead, the day you sealed this?";
const ANSWER_TEXT = "Walk answer: a quieter year and more time outdoors.";

/** How long the server may take to answer its health probe after start. */
const SERVER_START_MS = 60_000;
/** How long a passkey press or the sealing may take before the walk gives up. */
const SEAL_TIMEOUT_MS = 60_000;
/** The hold for one press: the press threshold plus a margin. */
const PRESS_HOLD_MS = SEAL_PRESS_HOLD_MS + 200;

/** The three widths the landing check runs at (spec 19, landing check). */
const LANDING_SIZES = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
] as const;

/**
 * The opening date the walk chooses: one year after today, as a calendar date.
 * It is far past the three-month minimum for a real letter.
 */
function openingDateOneYearAhead(): string {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

/** Wait until the server answers its health probe, or throw after `timeoutMs`. */
async function waitForHealth(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) return;
    } catch {
      // The server is not listening yet. Retry until the deadline.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`The local build did not answer ${BASE_URL}/api/health in time.`);
}

/** The box of a locator as the top, right, bottom and left edges the geometry helpers use. */
async function rectOf(locator: Locator): Promise<BoxRect> {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("An element the walk measures has no size on screen.");
  }
  return {
    top: box.y,
    right: box.x + box.width,
    bottom: box.y + box.height,
    left: box.x,
  };
}

/** Save one QA_Shot at the given width. The name carries the width and height. */
async function saveShot(page: Page, name: string, width: number, height: number): Promise<void> {
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}-${width}x${height}.png`) });
}

/** Wait until focus lands on the current step's [data-step-heading]. */
async function expectFocusOnHeading(page: Page, step: string): Promise<void> {
  await page
    .waitForFunction(
      () => document.activeElement?.hasAttribute("data-step-heading") === true,
      undefined,
      { timeout: 5000 },
    )
    .catch(() => {
      throw new Error(`Focus did not land on the [data-step-heading] of the ${step} step.`);
    });
}

/** Press the Press the seal control with the mouse, held past the press threshold. */
async function holdPressTheSeal(page: Page): Promise<void> {
  const press = page.locator(`button[aria-label="${PRESS_COPY.name}"]`);
  if ((await press.count()) === 0) {
    const labels = await page
      .locator("button")
      .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? (el.textContent ?? "").trim()));
    throw new Error(`No Press the seal control at ${page.url()}. Buttons on the page: ${labels.join(" | ")}`);
  }
  const box = await press.boundingBox();
  if (!box) {
    throw new Error("The Press the seal control has no size on screen.");
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(PRESS_HOLD_MS);
  await page.mouse.up();
}

/** Tick a visually hidden radio or checkbox the way a keyboard user does: focus it, press Space. */
async function tickWithKeyboard(locator: Locator): Promise<void> {
  if (await locator.isChecked()) return;
  await locator.focus();
  await locator.page().keyboard.press("Space");
  expect(await locator.isChecked(), "a control the walk ticks is checked").toBe(true);
}

/** Fill the letter and one author question with its answer on the Write step. */
async function writeLetter(page: Page): Promise<void> {
  await page.locator("#live-letter").fill(LETTER_TEXT);
  if ((await page.locator("[data-question-row]").count()) === 0) {
    await page.getByRole("button", { name: DESK_COPY.writeOwn, exact: true }).click();
  }
  await page.locator("[data-question-row] textarea:not([data-answer-input])").first().fill(QUESTION_TEXT);
  await page.locator("[data-question-row] textarea[data-answer-input]").first().fill(ANSWER_TEXT);
}

/** Read the letter, the question and the answer back from the Write step. */
async function expectWriteKept(page: Page, after: string): Promise<void> {
  expect(await page.locator("#live-letter").inputValue(), `letter text after ${after}`).toBe(LETTER_TEXT);
  expect(
    await page.locator("[data-question-row] textarea:not([data-answer-input])").first().inputValue(),
    `question after ${after}`,
  ).toBe(QUESTION_TEXT);
  expect(
    await page.locator("[data-question-row] textarea[data-answer-input]").first().inputValue(),
    `answer after ${after}`,
  ).toBe(ANSWER_TEXT);
}

/**
 * Seal the letter with the virtual passkey. A first press creates the passkey and
 * a second press confirms it, so the walk presses again while the confirm
 * control is still on screen. It stops when the Keep step shows.
 */
async function sealWithPasskey(page: Page): Promise<void> {
  const deadline = Date.now() + SEAL_TIMEOUT_MS;
  const keep = page.getByText(REAL_COPY.stillSealed).first();
  while (Date.now() < deadline) {
    if (await keep.isVisible().catch(() => false)) return;
    if ((await page.locator(`button[aria-label="${PRESS_COPY.name}"]`).count()) > 0) {
      await holdPressTheSeal(page);
    }
    await page.waitForTimeout(500);
  }
  await keep.waitFor({ state: "visible", timeout: 1000 });
}

let db: TestPostgres | null = null;
let server: ChildProcess | null = null;
let browser: Browser | null = null;

/** Every non-GET request the walk sends to this app, by path. Filled during the walk. */
let writePaths: string[] = [];

/** The visible links and buttons on the landing page, in document order. Set by the first width. */
let landingOrder: string[] | null = null;

describe.skipIf(!walkEnabled(process.env))("real walk", () => {
  beforeAll(async () => {
    db = await startTestPostgres();
    const migrate = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
      env: databaseCommandEnv(db.databaseUrl),
      encoding: "utf8",
    });
    if (migrate.status !== 0) {
      throw new Error(`Migrations failed with exit code ${migrate.status}.`);
    }
    mkdirSync(SHOTS_DIR, { recursive: true });
    server = spawn(
      process.execPath,
      ["node_modules/next/dist/bin/next", "start", "-p", String(REAL_WALK_PORT)],
      {
        env: {
          ...databaseCommandEnv(db.databaseUrl),
          REAL_SEALING: "on",
          RP_ID: "localhost",
          APP_ORIGIN: BASE_URL,
        },
        stdio: "ignore",
      },
    );
    await waitForHealth(SERVER_START_MS);
    browser = await launchWalkBrowser();
  }, 300_000);

  afterAll(async () => {
    await browser?.close().catch(() => undefined);
    server?.kill();
    if (db) {
      await removeTestPostgres(db.name);
    }
  });

  it.each(WALK_SIZES.map((size) => [`${size.width}x${size.height}`, size] as const))(
    "walks Write, Press the seal and Keep at %s",
    async (_label, size) => {
      if (!browser) throw new Error("The browser did not start.");
      const context = await browser.newContext({ viewport: size });
      try {
        const page = await context.newPage();
        await attachPrfAuthenticator(page);
        writePaths = [];
        page.on("request", (request) => {
          if (request.method() === "GET") return;
          writePaths.push(new URL(request.url()).pathname);
        });

        // Write.
        await page.goto(`${BASE_URL}/seal`);
        // A page load does not move focus (LiveStepper skips the first render), so wait
        // for the heading to show instead of expecting focus on it.
        await page.locator("[data-step-heading]").first().waitFor({ state: "visible" });
        await writeLetter(page);
        await saveShot(page, "seal-write", size.width, size.height);

        // Seal, with no opening date yet.
        await page.getByRole("button", { name: DESK_COPY.fold, exact: true }).click();
        await expectFocusOnHeading(page, "Seal");
        await saveShot(page, "seal-no-date", size.width, size.height);

        // Seal, with an opening date. Choose to skip the backup card, then tick the confirmation.
        const opensOn = openingDateOneYearAhead();
        await page.getByLabel(REAL_COPY.dateLabel, { exact: true }).fill(opensOn);
        await tickWithKeyboard(page.getByLabel(LIVE_COPY.backupChoiceSkip));
        const acknowledgements = page.getByRole("checkbox");
        for (let i = 0; i < (await acknowledgements.count()); i += 1) {
          await tickWithKeyboard(acknowledgements.nth(i));
        }
        // Ticking a control does not change the step, so focus stays where it was.
        await page.locator("[data-step-heading]").first().waitFor({ state: "visible" });
        await saveShot(page, "seal-with-date", size.width, size.height);

        // Back keeps the letter text, the answer and the chosen date.
        await page.getByRole("button", { name: LIVE_COPY.backToLetter, exact: true }).click();
        await expectFocusOnHeading(page, "Write after Back");
        await expectWriteKept(page, "Back");
        await page.getByRole("button", { name: DESK_COPY.fold, exact: true }).click();
        await expectFocusOnHeading(page, "Seal after Back");
        expect(
          await page.getByLabel(REAL_COPY.dateLabel, { exact: true }).inputValue(),
          "opening date after Back",
        ).toBe(opensOn);

        // Press the seal, then Keep.
        await sealWithPasskey(page);
        await expectFocusOnHeading(page, "Keep");
        await page.getByText(REAL_COPY.stillSealed).first().waitFor({ state: "visible" });
        await saveShot(page, "keep", size.width, size.height);

        // Every request that changes state goes to the letter API.
        const stray = writePaths.filter((requestPath) => !requestPath.startsWith("/api/letters/"));
        expect(stray, "seal requests outside /api/letters/").toEqual([]);

        // The desk at /demo/live, then its seal step.
        await page.goto(`${BASE_URL}/demo/live`);
        await saveShot(page, "demo-live-write", size.width, size.height);
        await writeLetter(page);
        const next = page.getByRole("button", { name: DESK_COPY.fold, exact: true });
        if ((await next.count()) > 0) await next.click();
        await page.waitForTimeout(300);
        await saveShot(page, "demo-live-seal", size.width, size.height);
      } finally {
        await context.close();
      }
    },
    600_000,
  );

  it.each(LANDING_SIZES.map((size) => [`${size.width}x${size.height}`, size] as const))(
    "keeps the real-seal link inside its box and in order at %s",
    async (_label, size) => {
      if (!browser) throw new Error("The browser did not start.");
      const context = await browser.newContext({ viewport: size });
      try {
        const page = await context.newPage();
        await page.goto(`${BASE_URL}/`);
        const seal = page.locator("p[data-real-seal]");
        await seal.waitFor({ state: "visible" });
        const link = page.locator('p[data-real-seal] a[href="/seal"]');

        const sealBox = await rectOf(seal);
        const linkBox = await rectOf(link);
        const inside = checkRectInside("Real_Seal_Link", linkBox, sealBox);
        expect(inside.ok, inside.message).toBe(true);

        const background = await seal.evaluate((el) => getComputedStyle(el).backgroundColor);
        expect(parseCssColor(background)?.a, `the .realSeal background ${background} is opaque`).toBe(1);

        // The CTAs and the link keep their order: the same visible actions, in the same
        // document order, at every width.
        const order = await page.evaluate(() =>
          Array.from(document.querySelectorAll("a[href], button"))
            .filter((el) => {
              const box = el.getBoundingClientRect();
              return box.width > 0 && box.height > 0 && getComputedStyle(el).visibility !== "hidden";
            })
            .map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim()),
        );
        expect(order).toContain(LANDING_COPY.realSealLink);
        if (landingOrder === null) {
          landingOrder = order;
        } else {
          expect(order, "the CTA and link order").toEqual(landingOrder);
        }
      } finally {
        await context.close();
      }
    },
  );
});
