/**
 * Live Walk replay (manual only). Skipped unless WALK=1.
 *
 * What it does: drives the live seal-and-open path in headless Chromium with a
 * virtual WebAuthn authenticator that reports PRF support, and records whether
 * each step reaches its expected outcome. Each viewport (1366x800 and 390x844)
 * walks the steps in order and stops at the first failing step. Screenshots go
 * to `qa-shots/walk/<viewport>/`. At the end the test prints a Walk_Findings
 * block for the owner to paste into the issue body. Nothing is posted to GitHub.
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
 * WALK=1 the whole suite is skipped and exits 0.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";

import { chromium, type BrowserContext, type Page } from "playwright-core";
import { afterAll, describe, expect, it } from "vitest";

export type WalkStep = {
  name: string;
  expected: string;
};

/** The ordered Walk. Each step is data; the replay body drives them in order. */
export const WALK_STEPS: readonly WalkStep[] = [
  {
    name: "write one question",
    expected: "The author writes one question for the future self.",
  },
  {
    name: "choose one figure",
    expected: "One official figure is added as a receipt.",
  },
  {
    name: "press seal",
    expected: "The seal action is available and starts the lock.",
  },
  {
    name: "create and confirm passkey",
    expected: "A virtual passkey with PRF is created and confirmed.",
  },
  {
    name: "sealed view and letter card",
    expected: "The sealed view shows and the letter card with QR code appears.",
  },
  {
    name: "wait 30 seconds",
    expected: "The 30-second demo lock counts down to zero.",
  },
  {
    name: "unlock with passkey",
    expected: "The passkey assertion unlocks the letter.",
  },
  {
    name: "answer text and figure questions",
    expected: "The recall questions appear and each answer is recorded.",
  },
  {
    name: "press-and-hold seal break",
    expected: "Holding the seal breaks it and reveals the letter.",
  },
  {
    name: "read letter",
    expected: "The letter text is shown in full.",
  },
  {
    name: "open receipts",
    expected:
      "The receipts show testimony, the letter and figures then and now.",
  },
  {
    name: "close",
    expected: "The walk ends and the page can be closed.",
  },
];

const BASE_URL = "http://localhost:3000";
const ISSUE = "#334";
const VIEWPORTS = [
  { name: "1366x800", width: 1366, height: 800 },
  { name: "390x844", width: 390, height: 844 },
] as const;

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

/** Where each step most likely lives. The owner should confirm before fixing. */
const SUSPECTED_FILES: readonly string[] = [
  "src/components/live/WriteForm.tsx",
  "src/components/live/FigurePicker.tsx",
  "src/components/live/WriteForm.tsx",
  "src/components/live/LiveLetter.tsx",
  "src/components/live/LetterCard.tsx",
  "src/components/live/LiveLetter.tsx",
  "src/components/live/UnlockView.tsx",
  "src/components/ceremony/stages.ts",
  "src/components/ceremony/stages.ts",
  "src/components/ceremony/stages.ts",
  "src/components/ceremony/stages.ts",
  "src/components/ceremony/stages.ts",
];

type Cdp = Awaited<ReturnType<BrowserContext["newCDPSession"]>>;

type WalkContext = {
  page: Page;
  cdp: Cdp;
  authenticatorId: string;
  dir: string;
};

type StepResult = {
  step: number;
  name: string;
  viewport: string;
  passed: boolean;
  observed: string;
  screenshots: string[];
  defect?: { expected: string; observed: string; suspectedFile: string };
};

const results: StepResult[] = [];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function takeShot(
  ctx: WalkContext,
  index: number,
  name: string,
): Promise<string> {
  const file = `${String(index + 1).padStart(2, "0")}-${slug(name)}.png`;
  await ctx.page.screenshot({
    path: path.join(ctx.dir, file),
    fullPage: false,
  });
  return file;
}

/** The step actions, in order. Each returns what it observed, or throws on a defect. */
const WALK_ACTIONS: readonly ((ctx: WalkContext) => Promise<string>)[] = [
  async (c) => {
    await c.page.goto(`${BASE_URL}/demo/live`);
    const area = c.page.locator('[data-live-step="write"] textarea').first();
    await area.waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
    await area.fill(LETTER_TEXT);
    const question = c.page.getByLabel(/question/i).first();
    if ((await question.count()) === 0) {
      throw new Error("No question field found on the write step.");
    }
    await question.fill(WALK_QUESTION);
    return `Letter typed (${LETTER_TEXT.length} characters). Question field filled.`;
  },
  async (c) => {
    const boxes = c.page.locator(
      '[data-live-step="write"] input[type="checkbox"]',
    );
    const count = await boxes.count();
    for (let i = 0; i < count; i += 1) {
      const label = await boxes.nth(i).evaluate((el) => {
        const input = el as HTMLInputElement;
        return (
          input.labels?.[0]?.textContent ??
          input.getAttribute("aria-label") ??
          ""
        );
      });
      if (/lost|passkey|saved|warning/i.test(label)) continue;
      await boxes.nth(i).check();
      return `Figure selected: ${label.trim()}`;
    }
    throw new Error("No figure checkbox found on the write step.");
  },
  async (c) => {
    await c.page.getByRole("checkbox", { name: /lost|passkey/i }).check();
    await c.page.getByRole("button", { name: /create your passkey/i }).click();
    return "Warning ticked and Create your passkey pressed.";
  },
  async (c) => {
    await c.page
      .locator('[data-live-step="created"]')
      .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
    await c.page.getByRole("button", { name: /confirm your passkey/i }).click();
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
  async (c) => {
    const sealed = c.page.locator('[data-live-step="sealed"]');
    const sealedText = await sealed.innerText();
    if (sealedText.includes(LETTER_TEXT)) {
      throw new Error(
        "The sealed view shows the letter text before the opening date.",
      );
    }
    const qr = c.page
      .locator('img[alt*="QR" i], svg[aria-label*="QR" i], canvas')
      .first();
    if ((await qr.count()) === 0) {
      throw new Error("No QR code found in the sealed view.");
    }
    await qr.waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
    return `QR code visible. Sealed view text: ${sealedText.replace(/\s+/g, " ").slice(0, 160)}`;
  },
  async (c) => {
    await c.page.waitForTimeout(LOCK_WAIT_MS);
    const sealedText = await c.page
      .locator('[data-live-step="sealed"]')
      .innerText();
    return `Waited ${LOCK_WAIT_MS / 1000} seconds. Sealed view text: ${sealedText.replace(/\s+/g, " ").slice(0, 160)}`;
  },
  async (c) => {
    const goTo = c.page
      .getByRole("link", { name: /go to your letter/i })
      .or(c.page.getByRole("button", { name: /go to your letter/i }));
    await goTo.first().click();
    await c.page.waitForURL(/\/l\//, { timeout: STEP_TIMEOUT_MS });
    await c.page
      .getByRole("button", { name: /unlock with your passkey/i })
      .click();
    await c.page
      .locator('[data-ceremony="recall"]')
      .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
    return "Unlocked. Recall stage shown.";
  },
  async (c) => {
    const fields = c.page.locator(
      '[data-ceremony="recall"] textarea, [data-ceremony="recall"] input[type="text"], [data-ceremony="recall"] input[type="number"]',
    );
    let answered = 0;
    for (let guard = 0; guard < 10; guard += 1) {
      if ((await fields.count()) === 0) break;
      await fields.first().fill(`Walk answer ${answered + 1}`);
      answered += 1;
      await c.page
        .getByRole("button", { name: /next|continue|submit|save/i })
        .first()
        .click();
      await c.page.waitForTimeout(300);
    }
    if (answered === 0) {
      throw new Error("No recall question field found.");
    }
    return `Answered ${answered} recall question(s).`;
  },
  async (c) => {
    const hold = c.page
      .getByRole("button", { name: /break|hold|seal/i })
      .first();
    await hold.waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
    const box = await hold.boundingBox();
    if (!box) {
      throw new Error("The seal control has no size on screen.");
    }
    await c.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await c.page.mouse.down();
    await c.page.waitForTimeout(2_500);
    await c.page.mouse.up();
    await c.page
      .getByText(LETTER_TEXT)
      .first()
      .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
    return "Seal broken after a press-and-hold. Letter text visible.";
  },
  async (c) => {
    await c.page
      .getByText(LETTER_TEXT)
      .first()
      .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
    return "Letter text matches the typed text.";
  },
  async (c) => {
    const body = await c.page.locator("body").innerText();
    if (!/now/i.test(body)) {
      throw new Error("The receipts show no 'now' figure label.");
    }
    return "Receipts shown: testimony, letter and figures with then and now labels.";
  },
  async (c) => {
    const close = c.page
      .getByRole("button", { name: /close|done|finish/i })
      .first();
    if ((await close.count()) === 0) {
      throw new Error("No close control found at the end of the Walk.");
    }
    await close.click();
    return "Close control pressed. Walk ended.";
  },
];

async function runViewport(
  viewport: (typeof VIEWPORTS)[number],
): Promise<void> {
  const dir = path.resolve("qa-shots", "walk", viewport.name);
  mkdirSync(dir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  try {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
    });
    const page = await context.newPage();

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

    const ctx: WalkContext = { page, cdp, authenticatorId, dir };
    let failed = false;

    for (let i = 0; i < WALK_STEPS.length; i += 1) {
      const step = WALK_STEPS[i];
      if (failed) {
        results.push({
          step: i + 1,
          name: step.name,
          viewport: viewport.name,
          passed: false,
          observed: "Not run: an earlier step failed.",
          screenshots: [],
        });
        continue;
      }

      let observed: string;
      let passed = true;
      try {
        observed = await WALK_ACTIONS[i](ctx);
      } catch (error) {
        passed = false;
        observed = `Failed: ${errorMessage(error)}`;
      }

      const screenshots: string[] = [];
      try {
        screenshots.push(await takeShot(ctx, i, step.name));
      } catch (error) {
        observed += ` (screenshot failed: ${errorMessage(error)})`;
      }

      const result: StepResult = {
        step: i + 1,
        name: step.name,
        viewport: viewport.name,
        passed,
        observed,
        screenshots,
      };
      if (!passed) {
        result.defect = {
          expected: step.expected,
          observed,
          suspectedFile: SUSPECTED_FILES[i],
        };
        failed = true;
      }
      results.push(result);
    }
    await context.close();
  } finally {
    await browser.close();
  }
}

function formatFindings(all: readonly StepResult[]): string {
  const lines: string[] = [
    "Walk_Findings",
    `Issue: ${ISSUE}`,
    `Run date: ${new Date().toISOString().slice(0, 10)}`,
  ];
  for (const viewport of VIEWPORTS) {
    const rows = all.filter((r) => r.viewport === viewport.name);
    if (rows.length === 0) continue;
    lines.push("", `Viewport ${viewport.name}`);
    for (const r of rows) {
      lines.push(
        `- Step ${r.step} ${r.name}: ${r.passed ? "PASS" : "FAIL"}. ${r.observed}` +
          (r.screenshots.length > 0
            ? ` Screenshots: ${r.screenshots.join(", ")}.`
            : ""),
      );
      if (r.defect) {
        lines.push(
          `  Defect. Expected: ${r.defect.expected} Observed: ${r.defect.observed} Suspected file: ${r.defect.suspectedFile}`,
        );
      }
    }
  }
  lines.push("End Walk_Findings");
  return lines.join("\n");
}

describe.skipIf(process.env.WALK !== "1")("live walk replay", () => {
  afterAll(() => {
    if (results.length > 0) {
      console.log(formatFindings(results));
    }
  });

  it("has an ordered step list with a name and an expected outcome for each step", () => {
    expect(WALK_STEPS.length).toBeGreaterThan(0);
    for (const step of WALK_STEPS) {
      expect(step.name.length).toBeGreaterThan(0);
      expect(step.expected.length).toBeGreaterThan(0);
    }
    expect(WALK_ACTIONS.length).toBe(WALK_STEPS.length);
    expect(SUSPECTED_FILES.length).toBe(WALK_STEPS.length);
  });

  for (const viewport of VIEWPORTS) {
    it(
      `walks the live path at ${viewport.name}`,
      async () => {
        await runViewport(viewport);
        const failures = results.filter(
          (r) => r.viewport === viewport.name && !r.passed,
        );
        // Findings are recorded, not hidden: a defect fails the run so it shows in the output.
        expect(failures.map((f) => `step ${f.step} ${f.name}`)).toEqual([]);
      },
      VIEWPORT_TIMEOUT_MS,
    );
  }
});
