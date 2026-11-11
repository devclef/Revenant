// Feature: 11-any-letter, Property 12 (X5.3, X5.4)
//
// `focusableUnderHidden(html)` returns every focusable element in a markup
// string that has an `aria-hidden="true"` ancestor. A screen reader skips that
// subtree, so a focusable control inside it can take keyboard focus that no one
// can hear. The check is a small tag tokenizer with a stack. It needs no HTML
// parser dependency, and it reads only the markup that React renders (static
// markup, with double-quoted attributes).

/** Elements with no closing tag. They never open a level on the stack. */
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
  "source",
  "track",
  "wbr",
]);

/** Elements whose text is not markup, so a `<` inside them is not a tag. */
const RAW_TEXT_ELEMENTS = new Set(["script", "style"]);

/** A focusable element: a native control, a link with an href, or a tabindex of 0 or more. */
export type FocusableUnderHidden = {
  /** The lower-case tag name. */
  tag: string;
  /** The opening tag as written in the markup. */
  openTag: string;
};

type Attr = { name: string; value: string | null };

type Level = { tag: string; hidden: boolean };

// One tag: `<name attrs>`, `</name>` or `<name attrs/>`. Comments and the
// doctype are stripped before this runs.
const TAG_PATTERN =
  /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/g;

const ATTR_PATTERN =
  /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function parseAttrs(source: string): Attr[] {
  const attrs: Attr[] = [];
  for (const match of source.matchAll(ATTR_PATTERN)) {
    const value = match[2] ?? match[3] ?? match[4] ?? null;
    attrs.push({ name: match[1].toLowerCase(), value });
  }
  return attrs;
}

function attr(attrs: Attr[], name: string): string | null | undefined {
  return attrs.find((a) => a.name === name)?.value;
}

function isFocusable(tag: string, attrs: Attr[]): boolean {
  const tabindex = attr(attrs, "tabindex");
  if (tabindex !== undefined && tabindex !== null) {
    const n = Number.parseInt(tabindex, 10);
    if (!Number.isNaN(n) && n >= 0) return true;
  }
  switch (tag) {
    case "button":
    case "select":
    case "textarea":
    case "summary":
      return true;
    case "a":
      return attr(attrs, "href") !== undefined;
    case "input":
      return (attr(attrs, "type") ?? "").toLowerCase() !== "hidden";
    default:
      return false;
  }
}

/**
 * Every focusable element in `html` that has an `aria-hidden="true"` ancestor,
 * in document order. Only ancestors count: an element's own `aria-hidden` does
 * not, so the caller decides what to do with a hidden element that is itself
 * focusable.
 */
export function focusableUnderHidden(html: string): FocusableUnderHidden[] {
  // Comments and the doctype never hold tags that matter here.
  const source = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<![^>]*>/g, "");

  const stack: Level[] = [];
  const found: FocusableUnderHidden[] = [];

  TAG_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG_PATTERN.exec(source)) !== null) {
    const [openTag, closing, nameRaw, attrSource, selfClosing] = match;
    const tag = nameRaw.toLowerCase();

    if (closing) {
      // Pop back to the nearest open element of this name. A stray close tag
      // with no match leaves the stack alone.
      const at = findLastIndex(stack, (level) => level.tag === tag);
      if (at !== -1) stack.length = at;
      continue;
    }

    const attrs = parseAttrs(attrSource);
    const hiddenAncestor = stack.some((level) => level.hidden);
    if (hiddenAncestor && isFocusable(tag, attrs)) {
      found.push({ tag, openTag });
    }

    const selfHidden = attr(attrs, "aria-hidden") === "true";
    if (selfClosing || VOID_ELEMENTS.has(tag)) continue;

    if (RAW_TEXT_ELEMENTS.has(tag)) {
      // Skip to the matching close tag so markup-like script text is ignored.
      const endAt = source
        .toLowerCase()
        .indexOf(`</${tag}`, match.index + openTag.length);
      if (endAt === -1) break;
      TAG_PATTERN.lastIndex = endAt;
      continue;
    }

    stack.push({ tag, hidden: selfHidden });
  }

  return found;
}

function findLastIndex<T>(items: T[], test: (item: T) => boolean): number {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    if (test(items[i])) return i;
  }
  return -1;
}
