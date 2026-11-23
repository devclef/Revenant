// Gate script: runs the layout check against the built standalone app (issue #590).
//
// Steps, in order:
//   1. Start `node .next/standalone/server.js` on a free port (PORT, HOSTNAME 127.0.0.1), with
//      RP_ID localhost and APP_ORIGIN http://localhost:<port>, so /demo/live can seal with a passkey.
//   2. Poll GET /api/health until it answers 200.
//   3. Run the database migrations, then the persona sealing, against DATABASE_URL.
//   4. Run tools/qa/layout-check.mjs --url <server url> with the args from buildGateArgs.
//   5. Stop the server in a finally block and return the layout-check exit code.
//
// Secrets (DATABASE_URL and the rest) come from the environment only. They are passed
// to the child processes and never printed.
//
// Usage: npm run layout-gate   (run `npm run build` first, so .next/standalone exists)

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { cp } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const GATE_SIZES = "1440x900,390x844";
const HEALTH_PATH = "/api/health";
const HEALTH_ATTEMPTS = 120;
const HEALTH_INTERVAL_MS = 500;
const STOP_TIMEOUT_MS = 5000;
// The blockers main already had when the gate landed. layout-check marks a blocker
// found here as "on main" and fails only on new ones, so the gate stops regressions
// without failing every PR on existing layout debt. Shrink it as blockers are fixed;
// refresh it with LAYOUT_GATE_SAVE=<file> npm run layout-gate on main.
export const GATE_BASELINE = join(ROOT, "tools", "qa", "layout-gate-baseline.json");

/**
 * The layout-check arguments for the gate, without --url (main adds that).
 * Never includes --require, so only the always-blocking rules can fail the gate.
 * @param {Record<string, string | undefined>} env
 * @param {{ baseline?: string | null }} [options] the baseline file, when it exists
 * @returns {string[]}
 */
export function buildGateArgs(env, { baseline = existsSync(GATE_BASELINE) ? GATE_BASELINE : null } = {}) {
  const args = ["--sizes", GATE_SIZES, "--shots", join(tmpdir(), "revenant-layout-gate")];
  if (env.CHROMIUM_PATH) args.push("--chromium", env.CHROMIUM_PATH);
  if (baseline) args.push("--baseline", baseline);
  if (env.LAYOUT_GATE_SAVE) args.push("--save-blockers", env.LAYOUT_GATE_SAVE);
  return args;
}

/** Asks the OS for a free TCP port on 127.0.0.1. */
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

/**
 * Copies `.next/static` and `public` next to the standalone server, as the
 * Dockerfile does. Without this the server answers 404 for every stylesheet
 * and script, so the page renders unstyled and layout-check measures that.
 * A missing source is skipped.
 * @param {string} [root]
 */
export async function stageStaticAssets(root = ROOT) {
  const standalone = join(root, ".next", "standalone");
  const copies = [
    [join(root, ".next", "static"), join(standalone, ".next", "static")],
    [join(root, "public"), join(standalone, "public")],
  ];
  for (const [from, to] of copies) {
    if (!existsSync(from)) continue;
    await cp(from, to, { recursive: true, force: true });
  }
}

/**
 * The app server's environment. RP_ID and APP_ORIGIN are always localhost on the
 * gate's port: without them /demo/live renders its "unavailable" state, so the
 * live walk never reaches Press the seal or Wait, and the rules there measure
 * nothing. An IP address is not a valid WebAuthn RP ID, so the page is served on
 * localhost, which browsers treat as a secure context. A caller's RP_ID or
 * APP_ORIGIN (for example revenant.devclef.se) would fail the same way, so it is
 * overridden.
 * @param {number} port
 * @param {Record<string, string | undefined>} env
 * @returns {Record<string, string | undefined>}
 */
export function serverEnv(port, env) {
  return {
    ...env,
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    RP_ID: "localhost",
    APP_ORIGIN: `http://localhost:${port}`,
  };
}

function startServer(port, env) {
  return spawn(process.execPath, [".next/standalone/server.js"], {
    cwd: ROOT,
    env: serverEnv(port, env),
    stdio: "inherit",
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForHealth(baseUrl, server) {
  for (let i = 0; i < HEALTH_ATTEMPTS; i++) {
    if (server.exitCode !== null || server.signalCode !== null) {
      throw new Error("the app server exited before it answered");
    }
    try {
      const res = await fetch(baseUrl + HEALTH_PATH, { signal: AbortSignal.timeout(2000) });
      await res.text();
      if (res.status === 200) return;
    } catch {
      // Not listening yet. Retry until the attempts run out.
    }
    await sleep(HEALTH_INTERVAL_MS);
  }
  throw new Error(`${HEALTH_PATH} did not answer 200 at ${baseUrl}`);
}

/** Runs a node script from the project root and resolves with its exit code. */
function runNode(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, env, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

function stopServer(server) {
  if (server.exitCode !== null || server.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => server.kill("SIGKILL"), STOP_TIMEOUT_MS);
    server.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    server.kill("SIGTERM");
  });
}

/**
 * Runs the gate. Resolves with the exit code of layout-check, or 1 if the
 * setup (server, health, migrations, persona sealing) fails.
 * @param {Record<string, string | undefined>} [env]
 * @returns {Promise<number>}
 */
export async function main(env = process.env) {
  let server;
  try {
    const port = await freePort();
    // The health probe uses the address the server binds. layout-check opens the
    // pages on localhost, the origin the passkeys are bound to (serverEnv).
    const healthUrl = `http://127.0.0.1:${port}`;
    const baseUrl = `http://localhost:${port}`;
    await stageStaticAssets();
    server = startServer(port, env);
    await waitForHealth(healthUrl, server);

    const migrateCode = await runNode(["scripts/migrate.mjs"], env);
    if (migrateCode !== 0) {
      console.error(`layout-gate: migrations exited with ${migrateCode}`);
      return 1;
    }
    const sealCode = await runNode(["dist/seal-personas.mjs"], env);
    if (sealCode !== 0) {
      console.error(`layout-gate: persona sealing exited with ${sealCode}`);
      return 1;
    }

    // `return await` keeps the server running until layout-check has finished.
    return await runNode(["tools/qa/layout-check.mjs", "--url", baseUrl, ...buildGateArgs(env)], env);
  } catch (err) {
    console.error(`layout-gate: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  } finally {
    if (server) await stopServer(server);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => {
    process.exitCode = code;
  });
}
