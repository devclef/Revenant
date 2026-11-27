import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isExcluded, liveBuild, locateBaseline, reapStale, resolveBaseline, treeKey } from "../../tools/qa/layout-baseline.mjs";
import { blockersFile } from "../../tools/qa/layout-scope.mjs";

/**
 * The layout baseline cache key and the wait/cleanup around the detached build. Uses a
 * throwaway git repository and cache folder; no browser, no Docker, no build.
 */

let repo = "";
let cache = "";

const git = (...args: string[]) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim();

function commitFile(path: string, text: string, message: string): string {
  const full = join(repo, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text);
  git("add", "-A");
  git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", message);
  return git("rev-parse", "HEAD");
}

const validFile = () => JSON.stringify(blockersFile({ rows: [], counts: { blocker: 0, polish: 0, note: 0 }, run: { sizes: [], onlySizes: null, stages: null }, complete: true }));

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "baseline-repo-"));
  cache = mkdtempSync(join(tmpdir(), "baseline-cache-"));
  git("init", "-q", "-b", "main");
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
  rmSync(cache, { recursive: true, force: true });
});

describe("isExcluded", () => {
  it("leaves out paths that cannot reach the built app", () => {
    for (const p of [".kiro/specs/18/tasks.md", ".github/agents.json", "deploy/helm/revenant/Chart.yaml", "docs/agent-loop.md", "docs/concept.png", "tools/dispatcher/x.py", "tools/agents/y.py", "tools/hooks/z.mjs", "scripts/check.sh"]) {
      expect(isExcluded(p), p).toBe(true);
    }
  });

  it("keeps everything the build reads, and anything in doubt", () => {
    for (const p of ["src/app/page.tsx", "package-lock.json", "content/personas/personas.json", "drizzle/0001.sql", "scripts/fetch-figures.ts", "tools/qa/layout-check.mjs", "docs/design/15-flow/prep.ts", "next.config.ts", "README.md", "Dockerfile", ".dockerignore"]) {
      expect(isExcluded(p), p).toBe(false);
    }
  });
});

describe("cache key", () => {
  it("is the same for two commits that differ only in excluded paths", () => {
    const a = commitFile("src/app/page.tsx", "export {};\n", "app");
    const b = commitFile(".kiro/specs/18/tasks.md", "- [x] 1\n", "Tick completed spec tasks [skip ci]");
    const c = commitFile("docs/notes.md", "hello\n", "docs");
    expect(new Set([treeKey(repo, a), treeKey(repo, b), treeKey(repo, c)]).size).toBe(1);
    const env = { REVENANT_LAYOUT_BASELINE_DIR: cache };
    const wa = locateBaseline({ base: a, cwd: repo, env });
    const wc = locateBaseline({ base: c, cwd: repo, env });
    expect(wa.commit).not.toBe(wc.commit);
    expect(wa.file).toBe(wc.file);
  });

  it("changes when a path under src/ changes", () => {
    const a = commitFile("src/app/page.tsx", "export {};\n", "app");
    const b = commitFile("src/app/page.tsx", "export const x = 1;\n", "change");
    expect(treeKey(repo, a)).not.toBe(treeKey(repo, b));
    const env = { REVENANT_LAYOUT_BASELINE_DIR: cache };
    expect(locateBaseline({ base: a, cwd: repo, env }).file).not.toBe(locateBaseline({ base: b, cwd: repo, env }).file);
  });
});

describe("resolveBaseline waits for a build in progress", () => {
  it("does not start a second build, prints progress, and returns the file the build writes", async () => {
    const commit = commitFile("src/app/page.tsx", "export {};\n", "app");
    process.env.REVENANT_LAYOUT_BASELINE_DIR = cache;
    try {
      const where = locateBaseline({ base: commit, cwd: repo });
      mkdirSync(join(cache, ".lock"), { recursive: true });
      writeFileSync(join(cache, ".lock", "owner"), `${process.pid} ${(await import("node:os")).hostname()} ${commit}\n`);
      writeFileSync(join(cache, ".lock", "stage"), "npm run build\n");
      expect(liveBuild(cache)?.stage).toBe("npm run build");
      // The build "finishes" only after the first progress line has been logged, so the
      // ordering does not depend on how fast the timers fire under load.
      const lines: string[] = [];
      const got = await resolveBaseline({
        base: commit,
        cwd: repo,
        log: (t: string) => {
          lines.push(t);
          if (/still building/.test(t)) writeFileSync(where.file, validFile());
        },
        spawnBuilder: () => {
          throw new Error("must not start a second build");
        },
        progressMs: 100,
        pollMs: 50,
      });
      expect(got.file).toBe(where.file);
      expect(got.cached).toBe(false);
      expect(lines.some((l) => /already running/.test(l))).toBe(true);
      expect(lines.some((l) => /still building .*npm run build/.test(l))).toBe(true);
    } finally {
      delete process.env.REVENANT_LAYOUT_BASELINE_DIR;
    }
  });
});

describe("reapStale", () => {
  it("kills the recorded process group, removes the container and deletes orphan temp files", async () => {
    mkdirSync(join(cache, "work"), { recursive: true });
    const lock = join(cache, ".lock-dead");
    mkdirSync(lock);
    // A process group of its own whose working directory is the build's work folder, and
    // whose parent is gone (as for an orphaned `npm start`), so it is reaped when killed.
    const pid = Number(execFileSync("sh", ["-c", "setsid sleep 60 </dev/null >/dev/null 2>&1 & echo $!"], { cwd: join(cache, "work"), encoding: "utf8" }).trim());
    // `setsid` runs a moment after the shell prints the pid; wait until the group exists.
    for (let i = 0; i < 100; i++) {
      try {
        process.kill(-pid, 0);
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 20));
      }
    }
    writeFileSync(join(lock, "state.json"), JSON.stringify({ appPgid: pid, container: "revenant-layout-baseline-test-1" }));
    const dead = join(cache, `${"a".repeat(40)}.json.tmp-999999999`);
    const mine = join(cache, `${"b".repeat(40)}.json.tmp-${process.pid}`);
    writeFileSync(dead, "{}");
    writeFileSync(mine, "{}");
    const removed: string[] = [];
    reapStale({ dir: cache, lock, remove: (name: string) => removed.push(name) });
    expect(removed).toEqual(["revenant-layout-baseline-test-1"]);
    expect(existsSync(dead)).toBe(false);
    expect(existsSync(mine)).toBe(true);
    // The orphan is reaped by init a moment after the kill.
    const gone = () => {
      try {
        process.kill(pid, 0);
        return false;
      } catch {
        return true;
      }
    };
    for (let i = 0; i < 40 && !gone(); i++) await new Promise((r) => setTimeout(r, 50));
    expect(gone()).toBe(true);
  });
});
