import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export type FileTree = Readonly<Record<string, string>>;

export function writeTree(root: string, files: FileTree): void {
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), text);
  }
}

/** A throwaway git repository, since the checker lists files through git. */
export function createRepository(files: FileTree): string {
  const root = mkdtempSync(path.join(tmpdir(), 'function-length-'));
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  writeTree(root, files);
  return root;
}

export function functionWithBody(name: string, bodyLines: number): string {
  const body = Array.from({ length: bodyLines }, (_, index) => `  const value${index} = ${index};`);
  return [`export function ${name}() {`, ...body, '}', ''].join('\n');
}
