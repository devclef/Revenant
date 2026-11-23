import { readFileSync } from "node:fs";
import { EventEmitter } from "node:events";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildGateArgs, main } from "../../tools/qa/layout-gate.mjs";

const spawnMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({ spawn: spawnMock }));

type FakeChild = EventEmitter & {
  exitCode: number | null;
  signalCode: string | null;
  killSignals: string[];
  kill: (signal: string) => boolean;
};

/**
 * A stand-in for a spawned process. Scripts exit on their own with the code
 * `exitCodes` gives for their first argument. The app server (no entry in
 * `exitCodes`) stays up until it is killed, then exits with the signal.
 */
function fakeChild(args: string[], exitCodes: Record<string, number>): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.exitCode = null;
  child.signalCode = null;
  child.killSignals = [];
  child.kill = (signal: string) => {
    child.killSignals.push(signal);
    setImmediate(() => {
      child.signalCode = signal;
      child.emit("exit", null, signal);
    });
    return true;
  };
  const key = args[0] ?? "";
  if (key in exitCodes) {
    setImmediate(() => {
      child.exitCode = exitCodes[key];
      child.emit("exit", exitCodes[key], null);
    });
  }
  return child;
}

describe("buildGateArgs", () => {
  it("runs the gate at 1440x900 and 390x844", () => {
    const args = buildGateArgs({});
    const i = args.indexOf("--sizes");
    expect(i).toBeGreaterThan(-1);
    expect(args[i + 1]).toBe("1440x900,390x844");
  });

  it("takes the Chromium path from CHROMIUM_PATH", () => {
    const args = buildGateArgs({ CHROMIUM_PATH: "/usr/bin/chromium" });
    const i = args.indexOf("--chromium");
    expect(i).toBeGreaterThan(-1);
    expect(args[i + 1]).toBe("/usr/bin/chromium");
  });

  it("omits --chromium when CHROMIUM_PATH is unset", () => {
    expect(buildGateArgs({})).not.toContain("--chromium");
  });

  it("never contains --require", () => {
    expect(buildGateArgs({})).not.toContain("--require");
    expect(buildGateArgs({ CHROMIUM_PATH: "/usr/bin/chromium" })).not.toContain("--require");
  });
});

describe("main", () => {
  beforeEach(() => {
    spawnMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
    // Every health probe answers 200, so the server is treated as ready.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("ok", { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns the layout-check exit code and stops the server when layout-check fails", async () => {
    const spawned: { args: string[]; child: FakeChild }[] = [];
    spawnMock.mockImplementation((_cmd: string, args: string[]) => {
      const child = fakeChild(args, {
        "scripts/migrate.mjs": 0,
        "dist/seal-personas.mjs": 0,
        "tools/qa/layout-check.mjs": 3,
      });
      spawned.push({ args, child });
      return child;
    });

    const code = await main({});

    expect(code).toBe(3);
    const layoutCheck = spawned.find((s) => s.args[0] === "tools/qa/layout-check.mjs");
    expect(layoutCheck?.child.exitCode).toBe(3);
    const server = spawned.find((s) => s.args[0] === ".next/standalone/server.js");
    expect(server).toBeDefined();
    expect(server?.child.killSignals).toEqual(["SIGTERM"]);
    expect(server?.child.signalCode).toBe("SIGTERM");
  });
});

describe("preserved layout-check verdicts", () => {
  // The gate runs tools/qa/layout-check.mjs unchanged, so its verdict rows must stay.
  // These checks read the source; they do not run a browser.
  const layoutCheckSource = readFileSync(
    fileURLToPath(new URL("../../tools/qa/layout-check.mjs", import.meta.url)),
    "utf8",
  );

  for (const id of ["R10.1", "R10.6", "R14.3", "R5.4"]) {
    it(`still has the ${id} verdict`, () => {
      expect(layoutCheckSource).toContain(`"${id}"`);
    });
  }

  for (const id of ["NB1", "GC1", "DL1", "PV1"]) {
    it(`still emits the ${id} verdict row`, () => {
      expect(layoutCheckSource).toContain(`verdictRow("${id}"`);
    });
  }

  // The NB1, GC1, DL1 and PV1 verdict helpers have unit tests in their own test file.
  const spec15TestSource = readFileSync(
    fileURLToPath(new URL("./layout-check-spec15-rows.test.ts", import.meta.url)),
    "utf8",
  );

  for (const helper of ["nb1Failures", "gc1Failures", "dl1Failures", "pv1Failures"]) {
    it(`keeps the ${helper} verdict tests`, () => {
      expect(spec15TestSource).toContain(`describe("${helper}"`);
    });
  }
});
