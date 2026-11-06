import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Renders the Helm chart with `helm template` and checks the seed Job that
// runs the figure fetch on every install and upgrade. Helm must be on PATH.
const CHART = fileURLToPath(
  new URL("../../deploy/helm/revenant", import.meta.url),
);

// Release name "revenant" and the default revision (1) give the Job name
// revenant-fetch-seed-r1.
function render(setValues: string[] = []): string {
  const args = ["template", "revenant", CHART];
  for (const value of setValues) args.push("--set", value);
  return execFileSync("helm", args, { encoding: "utf8" });
}

// Splits a rendered manifest into its YAML documents.
function documents(manifest: string): string[] {
  return manifest.split(/^---$/m).filter((doc) => doc.trim() !== "");
}

// Documents whose top-level kind is Job. A CronJob's nested jobTemplate has no
// top-level `kind: Job` line, so it is not counted.
function jobs(manifest: string): string[] {
  return documents(manifest).filter((doc) => /^kind: Job$/m.test(doc));
}

describe("seed Job with chart defaults", () => {
  const manifest = render();
  const [seed] = jobs(manifest);

  it("renders exactly one seed Job", () => {
    expect(jobs(manifest)).toHaveLength(1);
  });

  it("names the Job <fullname>-fetch-seed-r<revision>", () => {
    expect(seed).toMatch(/^ {2}name: revenant-fetch-seed-r1$/m);
  });

  it("is a plain Job with no Helm hook annotation", () => {
    expect(seed).not.toMatch(/helm\.sh\/hook/);
  });

  it("waits 600 seconds for the schema by default", () => {
    expect(seed).toMatch(/^ {12}- --wait-for-schema=600$/m);
  });

  it("does not retry inside the Job", () => {
    expect(seed).toMatch(/^ {2}backoffLimit: 0$/m);
    expect(seed).toMatch(/^ {6}restartPolicy: Never$/m);
  });

  it("sets activeDeadlineSeconds", () => {
    expect(seed).toMatch(/^ {2}activeDeadlineSeconds: \d+$/m);
  });

  it("keeps the Job after it finishes, so its logs stay available", () => {
    expect(seed).not.toMatch(/ttlSecondsAfterFinished/);
  });

  it("keeps the web Deployment and the fetch CronJob", () => {
    expect(manifest).toMatch(/^kind: Deployment$/m);
    expect(manifest).toMatch(/^kind: CronJob$/m);
  });
});

describe("seed Job guards", () => {
  it("renders no Job when fetchFigures.enabled is false", () => {
    expect(jobs(render(["fetchFigures.enabled=false"]))).toHaveLength(0);
  });

  it("renders no Job when fetchFigures.seedOnDeploy is false", () => {
    expect(jobs(render(["fetchFigures.seedOnDeploy=false"]))).toHaveLength(0);
  });

  it("uses fetchFigures.seedWaitForSchemaSeconds for the wait", () => {
    const [seed] = jobs(
      render(["fetchFigures.seedWaitForSchemaSeconds=300"]),
    );
    expect(seed).toMatch(/^ {12}- --wait-for-schema=300$/m);
  });
});
