import ts from 'typescript';
import { codeLines, countLinesBetween, lineOf } from './lines.js';
import type { Measurement, ScriptSource } from './measurement.js';

type MeasuredFunction = ts.FunctionLikeDeclaration & { body: ts.ConciseBody };

interface NamedFunction {
  readonly name: string;
  readonly node: MeasuredFunction;
}

type NamedDeclaration = ts.VariableDeclaration | ts.PropertyAssignment | ts.PropertyDeclaration;

const ANONYMOUS = 'anonymous';
const CONSTRUCTOR = 'constructor';
// Destructured names and callees split over lines must stay one token in the report.
const WHITESPACE = /\s+/g;
const SCRIPT_KINDS: Readonly<Record<ScriptSource['language'], ts.ScriptKind>> = {
  ts: ts.ScriptKind.TS,
  tsx: ts.ScriptKind.TSX,
  js: ts.ScriptKind.JS,
  jsx: ts.ScriptKind.JSX,
};

function isMeasuredFunction(node: ts.Node): node is MeasuredFunction {
  const isFunctionLike =
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isAccessor(node);
  return isFunctionLike && node.body !== undefined;
}

function hasDeclaredName(
  node: ts.Node,
): node is ts.VariableDeclaration | ts.PropertyAssignment | ts.PropertyDeclaration {
  return ts.isVariableDeclaration(node) || ts.isPropertyAssignment(node) || ts.isPropertyDeclaration(node);
}

// Only the called member is kept, so a long chain (z.object({...}).superRefine) stays a short, stable name.
function calleeName(callee: ts.Expression, sourceFile: ts.SourceFile): string {
  const member = ts.isPropertyAccessExpression(callee) ? callee.name : callee;
  return member.getText(sourceFile).replace(WHITESPACE, '');
}

function declaredName(declaration: NamedDeclaration, sourceFile: ts.SourceFile): string {
  return declaration.name.getText(sourceFile).replace(WHITESPACE, '');
}

function callbackName(call: ts.CallExpression, sourceFile: ts.SourceFile): string {
  const callee = `${calleeName(call.expression, sourceFile)}(callback)`;
  return hasDeclaredName(call.parent) ? `${declaredName(call.parent, sourceFile)}=${callee}` : callee;
}

function nameFromParent(node: ts.Node, sourceFile: ts.SourceFile): string {
  const parent = node.parent;
  if (hasDeclaredName(parent)) {
    return declaredName(parent, sourceFile);
  }
  return ts.isCallExpression(parent) ? callbackName(parent, sourceFile) : ANONYMOUS;
}

function nameOf(node: MeasuredFunction, sourceFile: ts.SourceFile): string {
  if (ts.isConstructorDeclaration(node)) {
    return CONSTRUCTOR;
  }
  return node.name ? node.name.getText(sourceFile) : nameFromParent(node, sourceFile);
}

function scopeNameOf(node: ts.Node, sourceFile: ts.SourceFile): string | undefined {
  if (isMeasuredFunction(node)) {
    return nameOf(node, sourceFile);
  }
  return ts.isClassLike(node) && node.name ? node.name.getText(sourceFile) : undefined;
}

function collectInto(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  scope: readonly string[],
  found: NamedFunction[],
): void {
  const scopeName = scopeNameOf(node, sourceFile);
  const childScope = scopeName ? [...scope, scopeName] : scope;
  if (isMeasuredFunction(node)) {
    found.push({ name: childScope.join('.'), node });
  }
  ts.forEachChild(node, (child) => collectInto(child, sourceFile, childScope, found));
}

export function collectFunctions(sourceFile: ts.SourceFile): NamedFunction[] {
  const found: NamedFunction[] = [];
  collectInto(sourceFile, sourceFile, [], found);
  return found;
}

/** Block or parenthesized bodies count between their delimiters; expression bodies after the arrow. */
export function bodyLength(
  node: MeasuredFunction,
  sourceFile: ts.SourceFile,
  lines: ReadonlySet<number>,
): number {
  const body = node.body;
  const startLine = lineOf(sourceFile, body.getStart(sourceFile));
  const endLine = lineOf(sourceFile, body.getEnd());
  if (ts.isBlock(body) || ts.isParenthesizedExpression(body)) {
    return countLinesBetween(lines, startLine + 1, endLine - 1);
  }
  const arrow = (node as ts.ArrowFunction).equalsGreaterThanToken;
  return countLinesBetween(lines, lineOf(sourceFile, arrow.getEnd()) + 1, endLine);
}

export function measureScript(script: ScriptSource): Measurement[] {
  const kind = SCRIPT_KINDS[script.language];
  const sourceFile = ts.createSourceFile(script.path, script.text, ts.ScriptTarget.Latest, true, kind);
  const lines = codeLines(sourceFile);
  return collectFunctions(sourceFile).map(({ name, node }) => ({
    path: script.path,
    line: lineOf(sourceFile, node.getStart(sourceFile)) + script.lineOffset,
    name,
    length: bodyLength(node, sourceFile, lines),
  }));
}
