import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOOLS_DIRECTORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const REPOSITORY_ROOT = path.resolve(TOOLS_DIRECTORY, '..');
export const CONFIG_PATH = path.join(TOOLS_DIRECTORY, 'function_length.json');
export const BASELINE_PATH = path.join(TOOLS_DIRECTORY, 'function_length_baseline.json');

export interface FunctionLengthConfig {
  readonly limit: number;
  readonly roots: readonly string[];
  readonly excludedDirectories: ReadonlySet<string>;
  readonly excludedFiles: readonly RegExp[];
}

interface RawConfig {
  limit: number;
  roots: string[];
  excludedDirectories: string[];
  excludedFilePatterns: string[];
}

export function loadConfig(configPath = CONFIG_PATH): FunctionLengthConfig {
  const raw = JSON.parse(readFileSync(configPath, 'utf8')) as RawConfig;
  return {
    limit: raw.limit,
    roots: raw.roots,
    excludedDirectories: new Set(raw.excludedDirectories),
    excludedFiles: raw.excludedFilePatterns.map((pattern) => new RegExp(pattern)),
  };
}
