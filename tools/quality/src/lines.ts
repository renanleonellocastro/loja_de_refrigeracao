import ts from 'typescript';

export function lineOf(sourceFile: ts.SourceFile, position: number): number {
  return sourceFile.getLineAndCharacterOfPosition(position).line + 1;
}

function markNonBlankLines(node: ts.Node, sourceFile: ts.SourceFile, lines: Set<number>): void {
  const firstLine = lineOf(sourceFile, node.getStart(sourceFile));
  const lastLine = lineOf(sourceFile, node.getEnd());
  const sourceLines = sourceFile.text.split('\n');
  for (let line = firstLine; line <= lastLine; line += 1) {
    if (sourceLines[line - 1]?.trim()) {
      lines.add(line);
    }
  }
}

function isTriviaNode(node: ts.Node, sourceFile: ts.SourceFile): boolean {
  const isJsxComment = ts.isJsxExpression(node) && !node.expression;
  return ts.isJSDoc(node) || isJsxComment || !node.getText(sourceFile).trim();
}

function markLeafLines(node: ts.Node, sourceFile: ts.SourceFile, lines: Set<number>): void {
  if (isTriviaNode(node, sourceFile)) {
    return;
  }
  const children = node.getChildren(sourceFile);
  if (children.length === 0) {
    markNonBlankLines(node, sourceFile, lines);
  }
  for (const child of children) {
    markLeafLines(child, sourceFile, lines);
  }
}

/** Lines holding at least one token, so blank and comment only lines never count. */
export function codeLines(sourceFile: ts.SourceFile): ReadonlySet<number> {
  const lines = new Set<number>();
  markLeafLines(sourceFile, sourceFile, lines);
  return lines;
}

export function countLinesBetween(lines: ReadonlySet<number>, firstLine: number, lastLine: number): number {
  let count = 0;
  for (let line = firstLine; line <= lastLine; line += 1) {
    count += lines.has(line) ? 1 : 0;
  }
  return count;
}
