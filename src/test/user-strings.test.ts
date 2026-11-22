import { describe, expect, it } from "vitest";

import {
  RETIRED_WORD,
  userStringsOfJson,
  userStringsOfText,
  userStringsOfTs,
} from "./user-strings";

const values = (entries: { value: string }[]) =>
  entries.map((entry) => entry.value);

describe("userStringsOfTs", () => {
  it("returns string literal values with their line numbers", () => {
    const source = [
      'const a = "Remember first";',
      "const b = 'The letter';",
      "const c = `Sealed on ${date}`;",
    ].join("\n");
    expect(userStringsOfTs("copy.ts", source)).toEqual([
      { file: "copy.ts", line: 1, value: "Remember first" },
      { file: "copy.ts", line: 2, value: "The letter" },
      { file: "copy.ts", line: 3, value: "Sealed on " },
    ]);
  });

  it("never returns a key name such as testimonyRecorded", () => {
    const source = [
      "const copy = {",
      '  testimonyRecorded: "You wrote this.",',
      '  "testimonyKey": "Kept.",',
      "};",
    ].join("\n");
    const result = userStringsOfTs("copy.ts", source);
    expect(values(result)).toEqual(["You wrote this.", "Kept."]);
    expect(result.some((entry) => entry.value === "testimonyRecorded")).toBe(
      false,
    );
  });

  it("ignores identifiers and comments", () => {
    const source = [
      "// testimony is only a comment",
      "const testimonyRecorded = 1;",
      "/* testify */",
    ].join("\n");
    expect(userStringsOfTs("copy.ts", source)).toEqual([]);
  });

  it("skips module specifiers", () => {
    const source = [
      'import { x } from "./testify-helper";',
      'export * from "./testimony";',
    ].join("\n");
    expect(userStringsOfTs("copy.ts", source)).toEqual([]);
  });

  it("skips element access arguments", () => {
    expect(userStringsOfTs("copy.ts", 'const v = obj["testify"];')).toEqual([]);
  });

  it("skips comparison operands and case labels", () => {
    const source = [
      'if (kind === "testify") {}',
      'if (kind !== "testify") {}',
      'if (kind == "testify") {}',
      'if (kind != "testify") {}',
      "switch (kind) {",
      '  case "testify": break;',
      "}",
    ].join("\n");
    expect(userStringsOfTs("copy.ts", source)).toEqual([]);
  });

  it("skips literal types", () => {
    expect(userStringsOfTs("copy.ts", 'type Kind = "testify";')).toEqual([]);
  });

  it("reads the literal parts of a template and the strings inside its expressions", () => {
    const source = "const t = `Before ${pick('testimony')} after`;";
    expect(values(userStringsOfTs("copy.ts", source))).toEqual([
      "Before ",
      " after",
      "testimony",
    ]);
  });

  it("reads a TSX file", () => {
    const source = 'export const C = () => <p title="Your letter">Hello</p>;';
    expect(values(userStringsOfTs("copy.tsx", source))).toEqual([
      "Your letter",
    ]);
  });
});

describe("userStringsOfJson", () => {
  it("returns every string value recursively and no key", () => {
    const source = JSON.stringify(
      {
        testimonyRecorded: "You wrote this.",
        nested: { list: ["One", "Two"], count: 3, flag: true },
      },
      null,
      2,
    );
    const result = userStringsOfJson("letter.json", source);
    expect(values(result)).toEqual(["You wrote this.", "One", "Two"]);
    expect(result[0]).toEqual({
      file: "letter.json",
      line: 2,
      value: "You wrote this.",
    });
  });

  it("throws on malformed JSON", () => {
    expect(() => userStringsOfJson("bad.json", "{ nope")).toThrow();
  });
});

describe("userStringsOfText", () => {
  it("returns each non-blank line as a value with its line number", () => {
    const source = "First line\n\nThe testify line\r\nLast";
    expect(userStringsOfText("us-maya.txt", source)).toEqual([
      { file: "us-maya.txt", line: 1, value: "First line" },
      { file: "us-maya.txt", line: 3, value: "The testify line" },
      { file: "us-maya.txt", line: 4, value: "Last" },
    ]);
  });
});

describe("RETIRED_WORD", () => {
  it("matches the retired word forms in a value", () => {
    expect(RETIRED_WORD.test("This is testimony.")).toBe(true);
    expect(RETIRED_WORD.test("She will testify.")).toBe(true);
    expect(RETIRED_WORD.test("TESTIFIED")).toBe(true);
  });

  it("does not match unrelated words", () => {
    expect(RETIRED_WORD.test("Remember first.")).toBe(false);
  });
});
