import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { FunctionLengthConfig } from './config.js';

const SOURCE_PATTERN = /\.(ts|tsx|js|jsx|mjs|cjs|vue)$/;
const GIT_LIST_FILES = ['ls-files', '-z', '--cached', '--others', '--exclude-standard'];

export function listRepositoryFiles(root: string): string[] {
  const listing = execFileSync('git', GIT_LIST_FILES, { cwd: root, encoding: 'utf8' });
  return listing.split('\0').filter((file) => file && existsSync(path.join(root, file)));
}

function isInsideRoots(file: string, config: FunctionLengthConfig): boolean {
  return config.roots.some((root) => file.startsWith(root));
}

function isInsideExcludedDirectory(file: string, config: FunctionLengthConfig): boolean {
  const directories = file.split('/').slice(0, -1);
  return directories.some((directory) => config.excludedDirectories.has(directory));
}

export function isProductionFile(file: string, config: FunctionLengthConfig): boolean {
  if (!SOURCE_PATTERN.test(file) || !isInsideRoots(file, config)) {
    return false;
  }
  if (isInsideExcludedDirectory(file, config)) {
    return false;
  }
  return !config.excludedFiles.some((pattern) => pattern.test(file));
}
