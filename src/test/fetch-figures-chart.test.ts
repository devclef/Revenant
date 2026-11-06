import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Text and regex checks on the Helm chart. No YAML parser is needed: the
// assertions only look at a handful of known keys and lines.
const CHART = fileURLToPath(
  new URL("../../deploy/helm/revenant", import.meta.url),
);
const read = (relative: string) =>
  readFileSync(`${CHART}/${relative}`, "utf8");

const values = read("values.yaml");
const cronjob = read("templates/cronjob-fetch-figures.yaml");
const configmap = read("templates/configmap.yaml");

// Returns the lines of the top-level `fetchFigures:` block in values.yaml.
function fetchFiguresBlock(): string {
  const lines = values.split("\n");
  const start = lines.findIndex((line) => /^fetchFigures:\s*$/.test(line));
  if (start === -1) throw new Error("fetchFigures block missing in values.yaml");
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    // The next top-level key ends the block. Comments and blank lines do not.
    if (/^[A-Za-z]/.test(line)) break;
    body.push(line);
  }
  return body.join("\n");
}

// Reads a scalar `key: value` from the fetchFigures block (quotes stripped).
function fetchFiguresValue(key: string): string | undefined {
  const match = fetchFiguresBlock().match(
    new RegExp(`^ {2}${key}:[ \\t]*(.*?)[ \\t]*$`, "m"),
  );
  if (!match) return undefined;
  return match[1].replace(/^"(.*)"$/, "$1");
}

describe("fetch-figures CronJob template", () => {
  it("is guarded by fetchFigures.enabled", () => {
    expect(cronjob).toMatch(/\{\{-?\s*if \.Values\.fetchFigures\.enabled\s*-?\}\}/);
  });

  it("forbids overlapping runs", () => {
    expect(cronjob).toMatch(/^\s*concurrencyPolicy: Forbid\s*$/m);
  });

  it("does not retry a failed run inside the Job", () => {
    expect(cronjob).toMatch(/^\s*backoffLimit: 0\s*$/m);
    expect(cronjob).toMatch(/restartPolicy: Never/);
  });

  it("takes its schedule from values", () => {
    expect(cronjob).toMatch(/schedule: \{\{ \.Values\.fetchFigures\.schedule \| quote \}\}/);
    expect(cronjob).toMatch(/timeZone: \{\{ \.Values\.fetchFigures\.timeZone \| quote \}\}/);
  });

  it("keeps at least one failed job in history", () => {
    const failed = Number(fetchFiguresValue("failedJobsHistoryLimit"));
    expect(Number.isInteger(failed)).toBe(true);
    expect(failed).toBeGreaterThanOrEqual(1);
    expect(cronjob).toMatch(
      /failedJobsHistoryLimit: \{\{ \.Values\.fetchFigures\.failedJobsHistoryLimit \}\}/,
    );
  });

  it("fails the render when a history limit is below 1", () => {
    expect(cronjob).toMatch(/successfulJobsHistoryLimit must be at least 1/);
    expect(cronjob).toMatch(/failedJobsHistoryLimit must be at least 1/);
  });

  it("runs the fetch script with DATABASE_URL from the existing Secret", () => {
    expect(cronjob).toMatch(/- scripts\/fetch-figures\.mjs/);
    expect(cronjob).toMatch(/secretKeyRef:[\s\S]*key: DATABASE_URL/);
  });

  it("reads non-secret config from the ConfigMap", () => {
    expect(cronjob).toMatch(/configMapRef:\s*\n\s*name: \{\{ include "revenant\.fullname" \. \}\}-config/);
  });
});

describe("fetch-figures values", () => {
  it("defaults the schedule to 06:17 every day in UTC", () => {
    expect(fetchFiguresValue("schedule")).toBe("17 6 * * *");
    expect(fetchFiguresValue("timeZone")).toBe("Etc/UTC");
  });

  it("is enabled by default", () => {
    expect(fetchFiguresValue("enabled")).toBe("true");
  });
});

describe("ConfigMap", () => {
  it("renders FIGURES_SOURCE from figures.source", () => {
    expect(configmap).toMatch(
      /^\s*FIGURES_SOURCE: \{\{ \.Values\.figures\.source \| quote \}\}\s*$/m,
    );
  });

  it("only allows the db or file figures source", () => {
    expect(configmap).toMatch(/list "db" "file"/);
    expect(values).toMatch(/^figures:\s*\n(?:[ \t]+.*\n|\s*\n)*?[ \t]+source: "?db"?\s*$/m);
  });

  it("holds no secret values", () => {
    expect(configmap).not.toMatch(/^\s*(DATABASE_URL|POSTGRES_PASSWORD):/m);
  });
});

describe("ConfigMap REAL_SEALING", () => {
  // Stands in for `helm template` with realSealing set to a given value by
  // replacing the one conditional that produces the REAL_SEALING line.
  function renderRealSealing(realSealing: boolean): string {
    const conditional = /\{\{ if \.Values\.realSealing \}\}"on"\{\{ else \}\}"off"\{\{ end \}\}/;
    if (!conditional.test(configmap)) {
      throw new Error("REAL_SEALING conditional missing in configmap.yaml");
    }
    return configmap.replace(conditional, realSealing ? '"on"' : '"off"');
  }

  it("renders REAL_SEALING as off when realSealing is false", () => {
    expect(renderRealSealing(false)).toMatch(/^\s*REAL_SEALING: "off"\s*$/m);
  });

  it("renders REAL_SEALING as on when realSealing is true", () => {
    expect(renderRealSealing(true)).toMatch(/^\s*REAL_SEALING: "on"\s*$/m);
  });
});

describe("chart templates", () => {
  it("render no Secret", () => {
    const templates = readdirSync(`${CHART}/templates`).filter((name) =>
      name.endsWith(".yaml") || name.endsWith(".tpl"),
    );
    for (const name of templates) {
      expect(read(`templates/${name}`), name).not.toMatch(/^kind:\s*Secret\s*$/m);
    }
  });
});
