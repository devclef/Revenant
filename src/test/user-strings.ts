import * as ts from "typescript";

/**
 * Test-only helpers for the retired-word scan (spec 16, design.md section 4).
 * They read the values a reader can see, never the names in the code: a
 * property key, an identifier, an import path or a comparison operand is not
 * user copy, so it is never returned.
 */

export type UserString = { path: string; line: number; value: string };

/** The words the scan retires from user copy. Matched against values only. */
export const RETIRED_WORD = /\btestif\w*|\btestimon\w*/i;

const EQUALITY_OPERATORS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);

/** Whether a string literal sits in a position no reader sees, so it is not a value. */
function isNonValuePosition(
  node: ts.Node,
  parent: ts.Node | undefined,
): boolean {
  if (!parent) return false;

  // Property names and member names: `{ "testify": 1 }`, class members, enum members.
  if (
    (ts.isPropertyAssignment(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isPropertySignature(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isMethodSignature(parent) ||
      ts.isEnumMember(parent) ||
      ts.isGetAccessorDeclaration(parent) ||
      ts.isSetAccessorDeclaration(parent)) &&
    parent.name === node
  ) {
    return true;
  }

  // Element access argument: `obj["testify"]`.
  if (
    ts.isElementAccessExpression(parent) &&
    parent.argumentExpression === node
  ) {
    return true;
  }

  // Module specifiers: `import ... from "x"`, `export ... from "x"`, `import x = require("x")`.
  if (
    ((ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) &&
      parent.moduleSpecifier === node) ||
    (ts.isExternalModuleReference(parent) && parent.expression === node)
  ) {
    return true;
  }

  // Type positions: `type Kind = "testify"`.
  if (ts.isLiteralTypeNode(parent)) return true;

  // Comparison operands: `kind === "testify"`.
  if (
    ts.isBinaryExpression(parent) &&
    EQUALITY_OPERATORS.has(parent.operatorToken.kind)
  ) {
    return true;
  }

  // Case labels: `case "testify":`.
  if (ts.isCaseClause(parent) && parent.expression === node) return true;

  return false;
}

function lineOf(sourceFile: ts.SourceFile, node: ts.Node): number {
  return (
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
  );
}

function walk(
  node: ts.Node,
  parent: ts.Node | undefined,
  sourceFile: ts.SourceFile,
  path: string,
  out: UserString[],
): void {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    if (node.text.length > 0 && !isNonValuePosition(node, parent)) {
      out.push({ path, line: lineOf(sourceFile, node), value: node.text });
    }
    return;
  }

  if (ts.isTemplateExpression(node)) {
    if (!isNonValuePosition(node, parent)) {
      const parts = [
        node.head,
        ...node.templateSpans.map((span) => span.literal),
      ];
      for (const part of parts) {
        if (part.text.length > 0) {
          out.push({ path, line: lineOf(sourceFile, part), value: part.text });
        }
      }
    }
    // The expressions inside `${ }` can hold strings of their own.
    for (const span of node.templateSpans) {
      walk(span.expression, span, sourceFile, path, out);
    }
    return;
  }

  ts.forEachChild(node, (child) => walk(child, node, sourceFile, path, out));
}

/** String literal values in a TypeScript or TSX file. Keys, names and comparisons are skipped. */
export function userStringsOfTs(path: string, source: string): UserString[] {
  const scriptKind = path.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const out: UserString[] = [];
  walk(sourceFile, undefined, sourceFile, path, out);
  return out;
}

/** Every string value in a JSON file, recursively. Object keys are never returned. */
export function userStringsOfJson(path: string, source: string): UserString[] {
  // Throws on malformed JSON, so a broken file never passes the scan silently.
  JSON.parse(source);
  const sourceFile = ts.parseJsonText(path, source);
  const out: UserString[] = [];
  walk(sourceFile, undefined, sourceFile, path, out);
  return out;
}

/** Plain text, one value per non-blank line. The line number is the line in the file. */
export function userStringsOfText(path: string, source: string): UserString[] {
  return source
    .split(/\r?\n/)
    .map((value, index) => ({ path, line: index + 1, value }))
    .filter((entry) => entry.value.trim().length > 0);
}
