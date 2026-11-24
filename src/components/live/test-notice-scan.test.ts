import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { REAL_COPY } from "./copy";

/**
 * The Test_Notice is retired from Real_Mode (spec 19, requirement 4.9). No
 * non-test source file under `src/` may hold its text, and REAL_COPY has no
 * `testNotice` key.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "../..");
const TEST_NOTICE =
  "This is a test site. A letter sealed here can only be opened here, or with its backup key.";

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      out.push(...sourceFiles(path));
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

describe("Test_Notice scan", () => {
  it("no non-test file under src/ contains the Test_Notice text", () => {
    const holders = sourceFiles(SRC).filter((file) =>
      readFileSync(file, "utf8").includes(TEST_NOTICE),
    );
    expect(holders).toEqual([]);
  });

  it("REAL_COPY has no testNotice key", () => {
    expect(Object.keys(REAL_COPY)).not.toContain("testNotice");
  });
});
