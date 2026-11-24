import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Checks the persona figure table in spec 18-persona-dates (design.md,
// "The eight Persona_Figures") against content/personas/personas.json.
const ROOT = fileURLToPath(new URL("../../", import.meta.url));

const DESIGN = readFileSync(
  new URL(".kiro/specs/18-persona-dates/design.md", `file://${ROOT}`),
  "utf8",
);
const PERSONAS = JSON.parse(
  readFileSync(
    new URL("content/personas/personas.json", `file://${ROOT}`),
    "utf8",
  ),
) as {
  personas: {
    key: string;
    written_as_of: string;
    opens_at: string;
    metrics: { metric_id: string }[];
  }[];
};

type FigureRow = {
  persona: string;
  metric: string;
  side: "Then" | "At opening";
  period: string;
};

// Table rows are only read from the section that holds the figure table.
function figureSection(): string {
  const start = DESIGN.indexOf("### The eight Persona_Figures");
  expect(start).toBeGreaterThan(-1);
  const rest = DESIGN.slice(start + 1);
  const next = rest.search(/\n##+ /);
  return next === -1 ? rest : rest.slice(0, next);
}

function figureRows(): FigureRow[] {
  const rows: FigureRow[] = [];
  for (const line of figureSection().split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    // A figure row starts with a persona key, then a metric id and a side.
    if (cells.length < 4 || !/^(us|eu)-/.test(cells[1] ?? "")) continue;
    const side = cells[3];
    if (side !== "Then" && side !== "At opening") continue;
    rows.push({
      persona: cells[1] as string,
      metric: cells[2] as string,
      side,
      period: cells[8] as string,
    });
  }
  return rows;
}

const ROWS = figureRows();

describe("persona figure table (spec 18) matches personas.json", () => {
  it("has exactly one row per persona figure (eight in total)", () => {
    expect(ROWS).toHaveLength(8);
  });

  it("has no duplicate persona, metric and side", () => {
    const keys = ROWS.map((r) => `${r.persona}|${r.metric}|${r.side}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has one Then and one At opening row for every persona metric", () => {
    for (const persona of PERSONAS.personas) {
      for (const { metric_id } of persona.metrics) {
        for (const side of ["Then", "At opening"] as const) {
          const matches = ROWS.filter(
            (r) =>
              r.persona === persona.key &&
              r.metric === metric_id &&
              r.side === side,
          );
          expect(matches, `${persona.key} ${metric_id} ${side}`).toHaveLength(
            1,
          );
        }
      }
    }
  });

  it("has no table row for a persona or metric missing from personas.json", () => {
    const known = new Set(
      PERSONAS.personas.flatMap((p) =>
        p.metrics.map((m) => `${p.key}|${m.metric_id}`),
      ),
    );
    for (const row of ROWS) {
      expect(known.has(`${row.persona}|${row.metric}`)).toBe(true);
    }
  });

  it("names the same written-as-of date as personas.json", () => {
    const writtenAsOf = new Set(PERSONAS.personas.map((p) => p.written_as_of));
    expect(writtenAsOf.size).toBe(1);
    const [date] = [...writtenAsOf];
    expect(figureSection()).toContain(`"${date}"`);
  });

  it("names the same opening date as personas.json", () => {
    const opens = new Set(PERSONAS.personas.map((p) => p.opens_at));
    expect(opens.size).toBe(1);
    const [opensAt] = [...opens];
    expect(figureSection()).toContain(opensAt as string);
  });

  it("puts every Then period in the week before the written-as-of date", () => {
    const asOf = Date.parse(`${PERSONAS.personas[0]?.written_as_of}T00:00:00Z`);
    for (const row of ROWS.filter((r) => r.side === "Then")) {
      const period = Date.parse(`${row.period}T00:00:00Z`);
      const days = (asOf - period) / 86_400_000;
      expect(days, `${row.persona} ${row.metric}`).toBeGreaterThanOrEqual(0);
      expect(days, `${row.persona} ${row.metric}`).toBeLessThan(7);
    }
  });

  it("puts every At opening period in the week before the opening date", () => {
    const opens = Date.parse(PERSONAS.personas[0]?.opens_at as string);
    for (const row of ROWS.filter((r) => r.side === "At opening")) {
      const period = Date.parse(`${row.period}T00:00:00Z`);
      const days = (opens - period) / 86_400_000;
      expect(days, `${row.persona} ${row.metric}`).toBeGreaterThanOrEqual(0);
      expect(days, `${row.persona} ${row.metric}`).toBeLessThan(7);
    }
  });
});
