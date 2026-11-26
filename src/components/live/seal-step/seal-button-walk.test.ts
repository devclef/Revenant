/**
 * Part C QA walk for the Seal_Button (spec 20, task 2.8; design "QA browser
 * steps, Part C"). Skipped unless WALK=1.
 *
 * Runs on /demo/live in headless Chromium at 1440 x 900 and 390 x 844, with
 * full motion and with Calm. Each check loads the page afresh, writes a letter
 * with one question and answer, folds to the Seal step and chooses the `card`
 * Backup_Choice. The spec 06 QA stub (`window.__qa`) replaces the passkey, so
 * `creates` counts the sealing prompts and `gets` counts the confirming prompts.
 *
 * The checks are:
 *   a  a quick down and up on the wax (150 ms) makes no prompt
 *   b  one Seal_Button click makes one create prompt
 *   c  after (b), one "Set the seal" click makes one get prompt
 *   d  a Seal_Button click and a wax hold within 100 ms make one prompt each
 *      time: one create in `write`, then one get in the created state
 *   e  before any press the Press_Status_Line says the full-motion hold line
 *   calm  with Calm on, a wax press held down with no release makes no
 *      prompt, one Seal_Button click makes one create, and the line says
 *      the Calm line before any press
 *
 * Product failures fail the test, so each failing check shows its route,
 * viewport, expected and observed value.
 *
 * How to run by hand:
 *   WALK=1 RP_ID=localhost APP_ORIGIN=http://localhost:3000 \
 *     npx vitest run src/components/live/seal-step/seal-button-walk.test.ts
 * With the app running at WALK_BASE_URL on a production build.
 */
import { chromium, type Page } from "playwright-core";
import { describe, expect, it } from "vitest";

import { PRESS_COPY } from "../press/copy";
import {
  PASSKEY_INIT_SCRIPT,
  WALK_BASE_URL,
} from "../../../test/integration/live-walk-helpers";
import { walkEnabled } from "../../../test/integration/live-walk-matrix";
import {
  PRESS_HOLD_MS,
  calmToggleNeeded,
} from "../../../test/integration/press-test-helpers";

const WALK_SIZES = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "390x844", width: 390, height: 844 },
] as const;

type WalkSize = (typeof WALK_SIZES)[number];

const WALK_LETTER =
  "Seal button walk letter: I will write this down before I read it.";
const WALK_ANSWER = "Seal button walk answer.";
const WALK_QUESTION = "What did you hope for the year ahead?";

/** The spec 06 QA stub, installed after the page has loaded. */
const QA_STUB = `(() => {
  const enc = new TextEncoder();
  const keyP = crypto.subtle.importKey("raw", enc.encode("qa-fixed-test-key-32-bytes-long!!"),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const S = (window.__qa = { log: [], creates: 0, gets: 0, mode: "ok", rawId: null, status: {}, delay: 800 });
  const buf = (u8) => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
  const bytes = (b) => (b instanceof ArrayBuffer ? new Uint8Array(b) : new Uint8Array(b.buffer, b.byteOffset, b.byteLength));
  const prf = async (salt) => new Uint8Array(await crypto.subtle.sign("HMAC", await keyP, bytes(salt)));
  // A real prompt takes time. The delay keeps the first prompt in flight for
  // the 100 ms double press of check (d). The counts are read at call time.
  const wait = () => new Promise((r) => setTimeout(r, S.delay));
  navigator.credentials.create = async (o) => {
    S.log.push(["create", performance.now()]); S.creates++;
    await wait();
    S.rawId = crypto.getRandomValues(new Uint8Array(32));
    const out = await prf(o.publicKey.extensions.prf.eval.first);
    return { rawId: buf(S.rawId), type: "public-key", getClientExtensionResults: () => ({ prf: { enabled: true, results: { first: buf(out) } } }) };
  };
  navigator.credentials.get = async (o) => {
    S.log.push(["get", performance.now()]); S.gets++;
    await wait();
    const out = await prf(o.publicKey.extensions.prf.eval.first);
    const id = S.rawId ?? bytes(o.publicKey.allowCredentials[0].id);
    return { rawId: buf(id), type: "public-key", getClientExtensionResults: () => ({ prf: { results: { first: buf(out) } } }) };
  };
  const real = window.fetch;
  window.fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input), location.href).pathname;
    S.log.push(["fetch " + url, performance.now()]);
    const stub = S.status[url];
    if (stub) return new Response(stub.body ?? "{}", { status: stub.status, headers: { "content-type": "application/json" } });
    return real(input, init);
  };
})()`;

type QaCounts = { creates: number; gets: number };

type WalkCheck = {
  id: string;
  route: "/demo/live";
  viewport: string;
  expected: string;
  observed: string;
  ok: boolean;
};

async function readCounts(page: Page): Promise<QaCounts> {
  return page.evaluate(() => {
    const qa = (window as unknown as { __qa: QaCounts }).__qa;
    return { creates: qa.creates, gets: qa.gets };
  });
}

/** Poll the counts until `key` reaches `target` or the budget runs out. */
async function waitForCount(
  page: Page,
  key: keyof QaCounts,
  target: number,
): Promise<number> {
  const deadline = Date.now() + 3_000;
  let value = (await readCounts(page))[key];
  while (value < target && Date.now() < deadline) {
    await page.waitForTimeout(50);
    value = (await readCounts(page))[key];
  }
  return value;
}

async function pressLine(page: Page): Promise<string> {
  return (
    (await page.locator("[data-press-line]").first().textContent()) ?? ""
  ).trim();
}

/** Centre of the wax, after it has been brought into view. */
async function waxCentre(page: Page): Promise<{ x: number; y: number }> {
  const wax = page.locator("[data-press-target]").first();
  await wax.scrollIntoViewIfNeeded();
  const box = await wax.boundingBox();
  if (!box) throw new Error("the wax has no size on screen");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Hold the wax down for `holdMs`, then release it. */
async function holdWax(page: Page, holdMs: number): Promise<void> {
  const { x, y } = await waxCentre(page);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(holdMs);
  await page.mouse.up();
}

async function clickSealButton(page: Page): Promise<void> {
  await page.locator("[data-seal-button]").first().click();
}

/** Open the page, set Calm if asked, write the letter and choose the card. */
async function prepareSeal(page: Page, calm: boolean): Promise<void> {
  await page.goto(`${WALK_BASE_URL}/demo/live`);
  await page
    .locator('[data-live-step="write"]')
    .waitFor({ state: "visible", timeout: 30_000 });
  const toggle = page.locator('[data-topbar-slot="calm"]').first();
  const label = (await toggle.getAttribute("aria-label")) ?? "";
  if (calmToggleNeeded(label, calm)) {
    await toggle.click();
  }
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

  // Fold to the Seal step with a hold on the Fold_Button, as the Press_Test does.
  const fold = page.locator("[data-fold-button]").first();
  await fold.scrollIntoViewIfNeeded();
  const foldBox = await fold.boundingBox();
  if (!foldBox) throw new Error("the Fold_Button has no size on screen");
  await page.mouse.move(
    foldBox.x + foldBox.width / 2,
    foldBox.y + foldBox.height / 2,
  );
  await page.mouse.down();
  await page.waitForTimeout(PRESS_HOLD_MS);
  await page.mouse.up();

  await page
    .locator("[data-seal-step]")
    .waitFor({ state: "visible", timeout: 10_000 });
  await page.locator('label[for="live-backup-choice-card"]').click();
  await page
    .locator("[data-seal-button]")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
}

/** Run one check in a fresh browser context and return its result. */
async function runCheck(id: CheckId, size: WalkSize): Promise<WalkCheck> {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  const viewport = size.name;
  const base = { route: "/demo/live" as const, viewport };
  try {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
    });
    await context.addInitScript(PASSKEY_INIT_SCRIPT);
    const page = await context.newPage();
    await prepareSeal(page, id === "calm");

    if (id === "a") {
      await holdWax(page, 150);
      await page.waitForTimeout(1_000);
      const creates = (await readCounts(page)).creates;
      return {
        ...base,
        id: "a",
        expected: "creates === 0",
        observed: `creates === ${creates}`,
        ok: creates === 0,
      };
    }

    if (id === "b") {
      await clickSealButton(page);
      const creates = await waitForCount(page, "creates", 1);
      return {
        ...base,
        id: "b",
        expected: "creates === 1",
        observed: `creates === ${creates}`,
        ok: creates === 1,
      };
    }

    if (id === "c") {
      await clickSealButton(page);
      await waitForCount(page, "creates", 1);
      await page
        .locator('[data-live-step="created"]')
        .waitFor({ state: "visible", timeout: 10_000 });
      const label = (
        (await page.locator("[data-seal-button]").first().textContent()) ?? ""
      ).trim();
      const getsBefore = (await readCounts(page)).gets;
      const labelOk = label === PRESS_COPY.sealButtonSet;
      await clickSealButton(page);
      const getsAfter = await waitForCount(page, "gets", 1);
      return {
        ...base,
        id: "c",
        expected: `label "${PRESS_COPY.sealButtonSet}", gets === 1 after one click`,
        observed: `label "${label}", gets ${getsBefore} before and ${getsAfter} after`,
        ok: labelOk && getsAfter === 1,
      };
    }

    if (id === "d") {
      const seal = page.locator("[data-seal-button]").first();
      await seal.click();
      await page.waitForTimeout(100);
      await holdWax(page, 1_000);
      await page.waitForTimeout(500);
      const creates = (await readCounts(page)).creates;

      await page
        .locator('[data-live-step="created"]')
        .waitFor({ state: "visible", timeout: 10_000 });
      await seal.click();
      await page.waitForTimeout(100);
      await holdWax(page, 1_000);
      await page.waitForTimeout(500);
      const gets = (await readCounts(page)).gets;
      return {
        ...base,
        id: "d",
        expected:
          "creates === 1 in write, then gets === 1 in the created state",
        observed: `creates === ${creates}, then gets === ${gets}`,
        ok: creates === 1 && gets === 1,
      };
    }

    if (id === "e") {
      const line = await pressLine(page);
      return {
        ...base,
        id: "e",
        expected: `line === "${PRESS_COPY.holdToSeal}"`,
        observed: `line === "${line}"`,
        ok: line === PRESS_COPY.holdToSeal,
      };
    }

    // Calm: the line before any press, a wax press with no release, then one
    // Seal_Button click.
    const calmLine = await pressLine(page);
    const { x, y } = await waxCentre(page);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(1_000);
    const afterWax = (await readCounts(page)).creates;
    await clickSealButton(page);
    const afterButton = await waitForCount(page, "creates", 1);
    return {
      ...base,
      id: "calm",
      expected: `Calm line === "${PRESS_COPY.pressToSeal}", wax down creates 0, Seal_Button creates 1`,
      observed: `Calm line === "${calmLine}", wax down creates ${afterWax}, Seal_Button creates ${afterButton}`,
      ok:
        calmLine === PRESS_COPY.pressToSeal &&
        afterWax === 0 &&
        afterButton === 1,
    };
  } finally {
    await browser.close();
  }
}

type CheckId = "a" | "b" | "c" | "d" | "e" | "calm";

const CHECK_IDS: readonly CheckId[] = ["a", "b", "c", "d", "e", "calm"];

function describeCheck(check: WalkCheck): string {
  return `Seal_Button walk | ${check.route} | ${check.viewport} | check ${check.id} | expected ${check.expected} | observed ${check.observed} | ${check.ok ? "PASS" : "FAIL"}`;
}

describe.skipIf(!walkEnabled(process.env))(
  "Seal_Button QA walk (spec 20, task 2.8)",
  () => {
    for (const size of WALK_SIZES) {
      for (const id of CHECK_IDS) {
        it(`check ${id} at ${size.name}`, async () => {
          const check = await runCheck(id, size);
          console.log(describeCheck(check));
          expect(check.ok, describeCheck(check)).toBe(true);
        }, 120_000);
      }
    }
  },
);
