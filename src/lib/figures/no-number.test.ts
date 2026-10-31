// Source-scan test (spec 03-persona-demo, design.md).
//
// decimal.ts, change.ts and format-change.ts must keep every figure value as an
// exact decimal STRING and never coerce one to a binary float. This test reads
// their SOURCE text and asserts the code contains no `Number(`, `parseFloat`,
// `parseInt`, nor a unary `+` applied to a value — the four ways a value could
// silently become a JS number.
//
// The forbidden tokens appear in those modules' own doc comments ("there is no
// Number(), parseFloat, parseInt..."), so a raw substring scan would flag the
// prose that promises the rule, not a violation of it. The scanner below first
// strips comments and string/template literals, then scans only the remaining
// executable code. Test files may touch the filesystem; the scanned modules
// stay pure.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const HERE = join(process.cwd(), "src", "lib", "figures");

const MODULES = ["decimal.ts", "change.ts", "format-change.ts"];

// Remove line comments, block comments and string/template literals from TS
// source, so the scan sees only executable code. A character-by-character pass
// is used rather than regexes because comment and string delimiters nest in
// ways a single regex cannot track (e.g. a "//" inside a string, a "/*" inside
// a template literal). Removed comment spans become a space; removed literals
// become an operand placeholder so token boundaries on either side survive.
function stripCommentsAndStrings(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;

  while (i < n) {
    const c = src[i];
    const next = i + 1 < n ? src[i + 1] : "";

    // Line comment: // ... end of line.
    if (c === "/" && next === "/") {
      i += 2;
      while (i < n && src[i] !== "\n") {
        i += 1;
      }
      out += " ";
      continue;
    }

    // Block comment: /* ... */.
    if (c === "/" && next === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
        i += 1;
      }
      i += 2; // skip the closing */
      out += " ";
      continue;
    }

    // String or template literal: '...', "...", `...`, honouring backslash
    // escapes. Template-literal ${...} substitutions are rare in these modules
    // and are treated as opaque string content here; that is safe because it
    // can only hide tokens, never invent one in real code.
    if (c === "'" || c === '"' || c === "`") {
      const quote = c;
      i += 1;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\") {
          i += 2; // skip the escaped character
          continue;
        }
        i += 1;
      }
      i += 1; // skip the closing quote
      // Leave a placeholder operand token behind: a literal is a value, so a
      // following "+" is a binary plus, not a coercion. A bare space here would
      // strip that operand signal and misread `"a" + b` as a unary plus.
      out += "0";
      continue;
    }

    out += c;
    i += 1;
  }

  return out;
}

// A unary plus applied to a value: a "+" that is NOT part of "++", "+=" or a
// binary "a + b". We detect the coercion idiom `+something` where the "+"
// directly precedes an identifier, number, parenthesis or quote and is itself
// preceded by something other than an operand (start, operator, "(", "[", ",",
// etc.). A binary plus is always preceded by an operand (identifier, digit,
// ")", "]" or a placeholder from a stripped literal) possibly across
// whitespace, so it is excluded.
function hasUnaryPlus(code: string): boolean {
  for (let i = 0; i < code.length; i += 1) {
    if (code[i] !== "+") {
      continue;
    }
    // Skip "++" and "+=" entirely.
    if (code[i + 1] === "+" || code[i + 1] === "=") {
      i += 1;
      continue;
    }
    if (code[i - 1] === "+") {
      // Second char of a "++" already handled by the branch above.
      continue;
    }

    // The character the "+" applies to (next non-space).
    let j = i + 1;
    while (j < code.length && /\s/.test(code[j])) {
      j += 1;
    }
    const operand = code[j];
    // "+" must precede a value-like token to be a coercion.
    if (operand === undefined || !/[A-Za-z0-9_($'"`]/.test(operand)) {
      continue;
    }

    // The character before the "+" (previous non-space).
    let k = i - 1;
    while (k >= 0 && /\s/.test(code[k])) {
      k -= 1;
    }
    const before = k >= 0 ? code[k] : "";
    // A binary plus is preceded by an operand end: identifier char, digit, or a
    // closing ) ] . If `before` is empty or an operator/opening bracket, this
    // "+" is unary (a coercion), which is what we forbid.
    const precededByOperand = /[A-Za-z0-9_)\]]/.test(before);
    if (!precededByOperand) {
      return true;
    }
  }
  return false;
}

describe("exact-decimal modules never coerce a value to a number", () => {
  for (const file of MODULES) {
    describe(file, () => {
      const raw = readFileSync(join(HERE, file), "utf8");
      const code = stripCommentsAndStrings(raw);

      it("contains no Number( call", () => {
        expect(code).not.toContain("Number(");
      });

      it("contains no parseFloat", () => {
        expect(code).not.toContain("parseFloat");
      });

      it("contains no parseInt", () => {
        expect(code).not.toContain("parseInt");
      });

      it("contains no unary + applied to a value", () => {
        expect(hasUnaryPlus(code)).toBe(false);
      });
    });
  }

  it("the scanner would catch each forbidden form if it were reintroduced", () => {
    // Guards against the scan passing vacuously: a sample of each violation,
    // and a line comment / string that must NOT trip it.
    expect(stripCommentsAndStrings("const x = Number(s);")).toContain("Number(");
    expect(stripCommentsAndStrings("// Number(s) in a comment")).not.toContain(
      "Number(",
    );
    expect(stripCommentsAndStrings('const m = "has parseInt text";')).not.toContain(
      "parseInt",
    );

    expect(hasUnaryPlus("const n = +s;")).toBe(true);
    expect(hasUnaryPlus("const n = +(a);")).toBe(true);
    expect(hasUnaryPlus("const n = a + b;")).toBe(false);
    expect(hasUnaryPlus("let i = 0; i += 1;")).toBe(false);
    expect(hasUnaryPlus("for (let i = 0; i < n; i++) {}")).toBe(false);
    // The real checks always scan code that has already passed through the
    // stripper, so string/template concatenation is exercised the same way:
    // a literal becomes an operand placeholder, leaving a binary plus.
    expect(hasUnaryPlus(stripCommentsAndStrings("const s = `${a}` + `${b}`;"))).toBe(
      false,
    );
    expect(hasUnaryPlus(stripCommentsAndStrings('const s = "a" + b;'))).toBe(false);
    expect(hasUnaryPlus(stripCommentsAndStrings('const n = +"3";'))).toBe(true);
  });
});
