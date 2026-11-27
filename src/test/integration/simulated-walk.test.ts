/**
 * Part B QA walk for Simulated_Mode (spec 20, Requirement 17.7; design "QA
 * browser steps, Part B"). Skipped unless WALK=1 and DATABASE_URL is set, and
 * skipped per test when the app or a Chromium browser cannot be reached.
 *
 * It runs on /demo/live with no QA stub and no virtual authenticator. An init
 * script counts calls to navigator.credentials.create and get, and makes both
 * reject at once with NotAllowedError, so a stray browser passkey call fails the
 * walk instead of hanging it. The same script records every 32-byte value that
 * crypto.getRandomValues or crypto.subtle.sign returns, so the reload check can
 * search the stores for them afterwards. The page never reads those records.
 *
 * The checks are:
 *   a      Simulated_Mode on: the notice is visible and the skip radio is disabled
 *   b      two Seal_Button presses seal the letter; both passkey counts stay 0
 *   c      the backup key card is open on the Wait step
 *   d      after 31 seconds, the in-page passkey unlock opens the letter; counts stay 0
 *   e      after a reload, on /l/<id>, the passkey control makes one browser get
 *          call, shows the cancelled notice, and leaves the key field enabled;
 *          no value recorded before the reload is in any store
 *   e2     four more passkey presses; the key field stays enabled after each
 *   f      the backup key opens the letter
 *   g      /seal (REAL_SEALING=on) has no Simulate_Control and no simulateLabel text
 *
 * Product failures fail the test, and each check prints one line with its
 * route, viewport, expected value and observed value.
 *
 * How to run by hand, against a running app with a database:
 *   WALK=1 DATABASE_URL=<url> RP_ID=localhost APP_ORIGIN=http://localhost:3000 \
 *     REAL_SEALING=on npx vitest run src/test/integration/simulated-walk.test.ts
 */
import type { Browser, BrowserContext, Page } from "playwright-core";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  type TestContext,
  vi,
} from "vitest";

import { LIVE_COPY } from "../../components/live/copy";
import { launchWalkBrowser, WALK_BASE_URL } from "./live-walk-helpers";
import { walkEnabled } from "./live-walk-matrix";

const WALK_LETTER =
  "Simulated walk letter: I will check the bus fare again next autumn.";
const WALK_QUESTION =
  "What did you hope for the year ahead, the day you sealed this?";
const WALK_ANSWER =
  "Simulated walk answer: a quieter year and more time outdoors.";

/** The seal opens 30 seconds after sealing; wait a little longer than that. */
const OPENS_WAIT_MS = 31_000;

const VIEWPORT = { width: 1440, height: 900 };

/**
 * Installed before the page loads. Counts and refuses browser passkey calls,
 * and records every 32-byte random or signed value for the reload check.
 */
const INIT = `(() => {
  const S = (window.__sim = { creates: 0, gets: 0, record: [] });
  const refuse = () => Promise.reject(new DOMException("walk: no browser passkey", "NotAllowedError"));
  navigator.credentials.create = () => { S.creates++; return refuse(); };
  navigator.credentials.get = () => { S.gets++; return refuse(); };
  const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const random = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = (array) => {
    const out = random(array);
    if (out && out.byteLength === 32) S.record.push(toHex(new Uint8Array(out.buffer, out.byteOffset, 32)));
    return out;
  };
  const sign = crypto.subtle.sign.bind(crypto.subtle);
  crypto.subtle.sign = async (...args) => {
    const out = await sign(...args);
    if (out.byteLength === 32) S.record.push(toHex(new Uint8Array(out)));
    return out;
  };
})()`;

/** Counts and recorded values, read from the page. */
type SimState = { creates: number; gets: number; record: string[] };

async function simState(page: Page): Promise<SimState> {
  return page.evaluate(() => {
    const sim = (window as unknown as { __sim: SimState }).__sim;
    return { creates: sim.creates, gets: sim.gets, record: [...sim.record] };
  });
}

/**
 * Every value in the stores a page can read after a reload, as one string:
 * localStorage, sessionStorage, cookies, the URL, history.state and the
 * contents of each IndexedDB database. A 32-byte value that appears in none of
 * them is not persisted.
 */
async function storeDump(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const parts: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i) ?? "";
      parts.push(key, localStorage.getItem(key) ?? "");
    }
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i) ?? "";
      parts.push(key, sessionStorage.getItem(key) ?? "");
    }
    parts.push(document.cookie, location.href, JSON.stringify(history.state ?? null));
    const databases = (await indexedDB.databases?.()) ?? [];
    for (const info of databases) {
      if (!info.name) continue;
      const db = await new Promise<IDBDatabase | null>((resolve) => {
        const open = indexedDB.open(info.name as string);
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => resolve(null);
      });
      if (db === null) continue;
      for (const storeName of Array.from(db.objectStoreNames)) {
        const values = await new Promise<unknown[]>((resolve) => {
          const request = db.transaction(storeName, "readonly").objectStore(storeName).getAll();
          request.onsuccess = () => resolve(request.result as unknown[]);
          request.onerror = () => resolve([]);
        });
        parts.push(
          JSON.stringify(values, (_key, value: unknown) =>
            value instanceof ArrayBuffer
              ? Array.from(new Uint8Array(value), (b) => b.toString(16).padStart(2, "0")).join("")
              : value,
          ),
        );
      }
      db.close();
    }
    return parts.join("\n");
  });
}

/** Each value in hex and in base64url, the two forms a store could hold it in. */
function encodingsOf(hex: string): string[] {
  return [hex, Buffer.from(hex, "hex").toString("base64url")];
}

/** Open the page, write a letter with one question and answer, and fold to the Seal step. */
async function openSealStep(page: Page): Promise<void> {
  await page.goto(`${WALK_BASE_URL}/demo/live`);
  await page
    .locator('[data-live-step="write"]')
    .waitFor({ state: "visible", timeout: 30_000 });

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
  await page.waitForTimeout(1_200);
  await page.mouse.up();

  await page
    .locator("[data-seal-step]")
    .waitFor({ state: "visible", timeout: 10_000 });
}

/** Wait until the Seal_Button can be pressed, then press it. */
async function pressSeal(page: Page): Promise<void> {
  const button = page.locator("[data-seal-button]").first();
  await page
    .locator('[data-seal-button]:not([aria-disabled="true"])')
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });
  await button.click();
}

/** Print one check line, in the format the other walks use. */
function report(id: string, route: string, expected: string, observed: string, ok: boolean): void {
  console.info(
    `Part B walk | ${route} | ${VIEWPORT.width}x${VIEWPORT.height} | check ${id} | expected ${expected} | observed ${observed} | ${ok ? "PASS" : "FAIL"}`,
  );
}

const WALK_ON = walkEnabled(process.env) && Boolean(process.env.DATABASE_URL);

// The checks run in order on one letter and include the 31-second wait, so
// each one needs far more than the default 5-second test timeout.
vi.setConfig({ testTimeout: 300_000, hookTimeout: 120_000 });

describe.skipIf(!WALK_ON)("Simulated_Mode QA walk (spec 20, Requirement 17.7)", () => {
  let browser: Browser | null = null;
  let appUp = false;
  /** Shared by the checks, which run in order on one sealed letter. */
  const run: {
    context?: BrowserContext;
    page?: Page;
    letterHref?: string;
    keyText?: string;
    recorded?: string[];
  } = {};

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
    await run.context?.close();
    await browser?.close();
  });

  /** Skip the current check when the app or the browser is missing. */
  function requireWalk(ctx: TestContext): Browser {
    if (browser === null || !appUp) ctx.skip();
    return browser as Browser;
  }

  it("a: Simulated_Mode on shows the notice and disables the skip radio", async (ctx) => {
    const walk = requireWalk(ctx);
    run.context = await walk.newContext({ viewport: VIEWPORT });
    const page = await run.context.newPage();
    run.page = page;
    await page.addInitScript(INIT);
    await openSealStep(page);

    await page.locator("[data-simulate-control] input").check();
    const notice = page.locator("[data-simulated-notice]");
    await notice.waitFor({ state: "visible", timeout: 10_000 });
    const skipDisabled = await page.locator('input[value="skip"]').isDisabled();
    report("a", "/demo/live", "notice visible, skip disabled", `notice visible, skip disabled=${skipDisabled}`, skipDisabled);
    expect(skipDisabled).toBe(true);
  });

  it("b: two Seal_Button presses seal the letter with no browser passkey call", async (ctx) => {
    requireWalk(ctx);
    const page = run.page as Page;
    await pressSeal(page);
    await page
      .locator('[data-live-step="created"]')
      .waitFor({ state: "attached", timeout: 60_000 });
    await pressSeal(page);
    await page
      .locator("[data-live-countdown]")
      .first()
      .waitFor({ state: "visible", timeout: 60_000 });

    const sim = await simState(page);
    report("b", "/demo/live", "creates 0, gets 0", `creates ${sim.creates}, gets ${sim.gets}`, sim.creates === 0 && sim.gets === 0);
    expect(sim.creates).toBe(0);
    expect(sim.gets).toBe(0);
  });

  it("c: the backup key card is open on the Wait step, with no show control", async (ctx) => {
    requireWalk(ctx);
    const page = run.page as Page;
    const card = page.locator("[data-live-backup-card]").first();
    await card.waitFor({ state: "visible", timeout: 10_000 });
    const offers = await page.locator("[data-live-backup-offer]").count();
    // The key is printed in groups, one span each. Join them with hyphens, as the form reads them.
    run.keyText = (await page.locator("[data-live-key] span").allTextContents()).join("-");
    run.letterHref = (await page.locator("[data-live-card-link]").first().textContent())?.trim() ?? undefined;
    const ok = offers === 0 && run.keyText.length > 0;
    report("c", "/demo/live", "card open, no backup offer", `card open, offers ${offers}`, ok);
    expect(offers).toBe(0);
    expect(run.keyText.length).toBeGreaterThan(0);
  });

  it("d: after the countdown the in-page passkey unlock opens the letter, with no browser call", async (ctx) => {
    requireWalk(ctx);
    const page = run.page as Page;
    await page.waitForTimeout(OPENS_WAIT_MS);
    // When the countdown ends the Wait step offers "Open the letter", which
    // shows the in-page unlock.
    const open = page.locator("[data-live-open]").first();
    await open.waitFor({ state: "visible", timeout: 60_000 });
    await open.click();
    const unlock = page.getByRole("button", { name: LIVE_COPY.unlockPasskey, exact: true }).first();
    await unlock.waitFor({ state: "visible", timeout: 20_000 });
    await unlock.click();
    await page.waitForTimeout(2_000);

    const sim = await simState(page);
    report("d", "/demo/live", "creates 0, gets 0, letter opens", `creates ${sim.creates}, gets ${sim.gets}`, sim.creates === 0 && sim.gets === 0);
    expect(sim.creates).toBe(0);
    expect(sim.gets).toBe(0);
  });

  it("e: after a reload, the letter's passkey control fails safely and nothing recorded is stored", async (ctx) => {
    requireWalk(ctx);
    const page = run.page as Page;
    run.recorded = (await simState(page)).record;
    expect(run.letterHref, "the Wait step link").toBeDefined();

    // The reload drops the Simulated_Port. The letter page then loads in place
    // of the demo page; its own load resets the counters the init script keeps.
    await page.reload();
    await page.goto(run.letterHref as string);
    await page.locator("#unlock-backup-key").waitFor({ state: "visible", timeout: 30_000 });
    await page.getByRole("button", { name: LIVE_COPY.unlockPasskey, exact: true }).click();
    await page.locator('[role="status"]').filter({ hasText: LIVE_COPY.noticeCancelled }).waitFor({ timeout: 10_000 });

    const sim = await simState(page);
    const keyEnabled = await page.locator("#unlock-backup-key").isEnabled();
    const submitEnabled = await page.getByRole("button", { name: LIVE_COPY.backupSubmit, exact: true }).isEnabled();
    const dump = await storeDump(page);
    const leaked = (run.recorded ?? []).filter((hex) => encodingsOf(hex).some((form) => dump.includes(form)));
    const recordedCount = run.recorded?.length ?? 0;
    const ok = sim.gets === 1 && keyEnabled && submitEnabled && recordedCount > 0 && leaked.length === 0;
    report(
      "e",
      "/l/<id>",
      "gets 1, cancelled notice, key and submit enabled, values recorded before the reload, none stored",
      `gets ${sim.gets}, key enabled ${keyEnabled}, submit enabled ${submitEnabled}, recorded ${recordedCount}, stored ${leaked.length}`,
      ok,
    );
    expect(recordedCount, "32-byte values recorded before the reload").toBeGreaterThan(0);
    expect(sim.gets).toBe(1);
    expect(keyEnabled).toBe(true);
    expect(submitEnabled).toBe(true);
    expect(leaked).toEqual([]);
  });

  it("e2: the key field stays usable after four more passkey presses", async (ctx) => {
    requireWalk(ctx);
    const page = run.page as Page;
    const results: boolean[] = [];
    for (let i = 0; i < 4; i += 1) {
      await page.getByRole("button", { name: LIVE_COPY.unlockPasskey, exact: true }).click();
      await page.waitForTimeout(500);
      results.push(await page.locator("#unlock-backup-key").isEnabled());
    }
    const ok = results.every(Boolean);
    report("e2", "/l/<id>", "key enabled after each press", `enabled ${results.join(",")}`, ok);
    expect(ok).toBe(true);
  });

  it("f: the backup key opens the letter", async (ctx) => {
    requireWalk(ctx);
    const page = run.page as Page;
    await page.locator("#unlock-backup-key").fill(run.keyText ?? "");
    await page.getByRole("button", { name: LIVE_COPY.backupSubmit, exact: true }).click();
    await page.locator("#unlock-backup-key").waitFor({ state: "hidden", timeout: 60_000 });
    report("f", "/l/<id>", "letter opens with the backup key", "unlock field hidden", true);
  });

  it("g: /seal with REAL_SEALING=on has no Simulate_Control and no simulateLabel text", async (ctx) => {
    const walk = requireWalk(ctx);
    const context = await walk.newContext({ viewport: VIEWPORT });
    try {
      const page = await context.newPage();
      await page.goto(`${WALK_BASE_URL}/seal`);
      await page.locator('[data-seal-mode="real"]').first().waitFor({ state: "attached", timeout: 30_000 });
      const controls = await page.locator("[data-simulate-control]").count();
      const bodyText = (await page.locator("body").textContent()) ?? "";
      const labelShown = bodyText.includes(LIVE_COPY.simulateLabel);
      const ok = controls === 0 && !labelShown;
      report("g", "/seal", "no Simulate_Control, no simulateLabel", `controls ${controls}, label shown ${labelShown}`, ok);
      expect(controls).toBe(0);
      expect(labelShown).toBe(false);
    } finally {
      await context.close();
    }
  });
});
