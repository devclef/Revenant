import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Text checks on the Dockerfile. The runner stage must ship public/ so files
// such as icon.svg are served from the site root.
const dockerfile = readFileSync(
  fileURLToPath(new URL("../../Dockerfile", import.meta.url)),
  "utf8",
);

// The runner stage is the text after the `AS runner` line.
const runnerStage = dockerfile.slice(dockerfile.indexOf("FROM base AS runner"));

describe("Dockerfile runner stage: public/", () => {
  it("copies /app/public from the builder into ./public", () => {
    const copyLine = runnerStage
      .split("\n")
      .find((line) => /^COPY\s/.test(line) && line.includes("/app/public"));
    expect(copyLine).toBeDefined();
    expect(copyLine).toBe(
      "COPY --from=builder --chown=1001:1001 /app/public ./public",
    );
  });

  it("owns the copied public/ files by UID/GID 1001 (the runner user)", () => {
    const copyLine = runnerStage
      .split("\n")
      .find((line) => line.includes("/app/public"));
    expect(copyLine).toMatch(/--chown=1001:1001\b/);
  });

  it("no longer carries the stale 'no public/ dir' comment", () => {
    expect(dockerfile).not.toMatch(/There is no public\/ dir/);
    expect(dockerfile).not.toMatch(/add its\s*\n# COPY here/);
  });
});
