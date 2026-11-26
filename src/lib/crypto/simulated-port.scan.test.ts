// Source scan for the Simulated_Port module (spec 20, Part B). The module must
// touch no storage, console, service worker, history, network or beacon API,
// so no secret byte can leave its closure. Comments and string literals are
// blanked first, so documentation mentions do not count as usage.

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const modulePath = resolve(here, "simulated-port.ts");

const FORBIDDEN = [
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "document.cookie",
  "console.",
  "serviceWorker",
  "history.",
  "fetch(",
  "XMLHttpRequest",
  "sendBeacon",
];

/** Replaces the body of comments and string literals with spaces, keeping line breaks. */
function blankCommentsAndStrings(source: string): string {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (c === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") {
        out += " ";
        i += 1;
      }
    } else if (c === "/" && next === "*") {
      out += "  ";
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        out += source[i] === "\n" ? "\n" : " ";
        i += 1;
      }
      out += "  ";
      i += 2;
    } else if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      out += " ";
      i += 1;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === "\\") {
          out += "  ";
          i += 2;
          continue;
        }
        out += source[i] === "\n" ? "\n" : " ";
        i += 1;
      }
      out += " ";
      i += 1;
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}

describe("simulated-port.ts source scan", () => {
  it("the module exists at its expected path", () => {
    expect(existsSync(modulePath)).toBe(true);
  });

  it("uses none of the storage, console, network or history APIs", () => {
    const code = blankCommentsAndStrings(readFileSync(modulePath, "utf8"));
    const hits = FORBIDDEN.filter((token) => code.includes(token));
    expect(hits).toEqual([]);
  });
});
