// Gate script: runs the layout check against the built standalone app (issue #590).
//
// Steps, in order:
//   1. Start `node .next/standalone/server.js` on a free port (PORT, HOSTNAME 127.0.0.1).
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

/**
 * The layout-check arguments for the gate, without --url (main adds that).
 * Never includes --require, so only the always-blocking rules can fail the gate.
 * @param {Record<string, string | undefined>} env
 * @returns {string[]}
 */
export function buildGateArgs(env) {
  const args = ["--sizes", GATE_SIZES, "--shots", join(tmpdir(), "revenant-layout-gate")];
  if (env.CHROMIUM_PATH) args.push("--chromium", env.CHROMIUM_PATH);
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

function startServer(port, env) {
  return spawn(process.execPath, [".next/standalone/server.js"], {
    cwd: ROOT,
    env: { ...env, PORT: String(port), HOSTNAME: "127.0.0.1" },
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
    const baseUrl = `http://127.0.0.1:${port}`;
    server = startServer(port, env);
    await waitForHealth(baseUrl, server);

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
