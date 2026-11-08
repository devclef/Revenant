/**
 * Test-only helper. Returns the text of every text node in an HTML string
 * that sits outside any element carrying a `data-user-content` attribute.
 * Text inside such an element (a letter, a testimony answer) is user content
 * and is never returned, so copy checks only see Revenant's own words.
 *
 * The project has no HTML parser in its devDependencies, so this is a small
 * tokenizer for server-rendered markup. It skips comments and doctypes,
 * treats `script`, `style`, `textarea` and `title` contents as text, skips
 * void elements, and decodes the common character references in text.
 * Text nodes that are empty after decoding are dropped.
 *
 * This module must not be imported by any file under `src/` outside `src/test/`.
 */

const USER_CONTENT_ATTR = "data-user-content";

const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const RAW_TEXT_ELEMENTS = new Set(["script", "style", "textarea", "title"]);

const TAG_START = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)/y;
const ATTRIBUTE = /[\s/]*([^\s"'>/=]+)(\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/y;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
};

interface OpenElement {
  name: string;
  userContent: boolean;
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      return String.fromCodePoint(parseInt(body.slice(2), 16));
    }
    if (body.startsWith("#")) {
      return String.fromCodePoint(parseInt(body.slice(1), 10));
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

/** Index just past the `>` that closes the tag starting at `start`, honouring quotes. */
function findTagEnd(html: string, start: number): number {
  let quote: string | null = null;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === ">") {
      return i + 1;
    }
  }
  return html.length;
}

/** Whether the attribute text of an opening tag contains a `data-user-content` attribute. */
function hasUserContentAttribute(attributes: string): boolean {
  let pos = 0;
  while (pos < attributes.length) {
    ATTRIBUTE.lastIndex = pos;
    const match = ATTRIBUTE.exec(attributes);
    if (!match) {
      pos++;
      continue;
    }
    if (match[1].toLowerCase() === USER_CONTENT_ATTR) return true;
    pos = ATTRIBUTE.lastIndex;
  }
  return false;
}

export function textOutsideUserContent(html: string): string[] {
  const texts: string[] = [];
  const stack: OpenElement[] = [];

  const emit = (raw: string): void => {
    if (raw.length === 0) return;
    if (stack.some((element) => element.userContent)) return;
    const decoded = decodeEntities(raw);
    if (decoded.length > 0) texts.push(decoded);
  };

  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      emit(html.slice(i));
      break;
    }
    emit(html.slice(i, lt));
    i = lt;

    if (html.startsWith("<!--", i)) {
      const end = html.indexOf("-->", i + 4);
      i = end === -1 ? html.length : end + 3;
      continue;
    }
    if (html[i + 1] === "!" || html[i + 1] === "?") {
      const end = html.indexOf(">", i + 2);
      i = end === -1 ? html.length : end + 1;
      continue;
    }

    TAG_START.lastIndex = i;
    const start = TAG_START.exec(html);
    if (!start) {
      // A bare "<" that does not open a tag is text.
      emit("<");
      i++;
      continue;
    }

    const isClosing = start[1] === "/";
    const name = start[2].toLowerCase();
    const tagEnd = findTagEnd(html, i + start[0].length);
    const attributes = html.slice(i + start[0].length, tagEnd - 1);
    i = tagEnd;

    if (isClosing) {
      for (let s = stack.length - 1; s >= 0; s--) {
        if (stack[s].name === name) {
          stack.length = s;
          break;
        }
      }
      continue;
    }

    const selfClosing = attributes.trimEnd().endsWith("/");
    if (VOID_ELEMENTS.has(name) || selfClosing) continue;

    stack.push({ name, userContent: hasUserContentAttribute(attributes) });

    if (RAW_TEXT_ELEMENTS.has(name)) {
      const closeAt = html.toLowerCase().indexOf(`</${name}`, i);
      const rawEnd = closeAt === -1 ? html.length : closeAt;
      emit(html.slice(i, rawEnd));
      i = rawEnd;
    }
  }

  return texts;
}
