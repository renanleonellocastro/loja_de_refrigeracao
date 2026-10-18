import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { FunctionLengthConfig } from './config.js';
import { isProductionFile, listRepositoryFiles } from './files.js';
import { measureScript } from './functions.js';
import type { Measurement, ScriptSource } from './measurement.js';
import { vueScripts } from './vue.js';

type ScriptReader = (file: string, text: string) => ScriptSource[];

const TYPESCRIPT_PATTERN = /\.[cm]?tsx?$/;
const JSX_PATTERN = /x$/;

function plainScript(file: string, text: string): ScriptSource[] {
  const family = TYPESCRIPT_PATTERN.test(file) ? 'ts' : 'js';
  const language = JSX_PATTERN.test(file) ? (`${family}x` as const) : family;
  return [{ path: file, text, language, lineOffset: 0 }];
}

const READERS: Readonly<Record<string, ScriptReader>> = { '.vue': vueScripts };

export function scriptsOf(file: string, text: string): ScriptSource[] {
  const reader = READERS[path.extname(file)] ?? plainScript;
  return reader(file, text);
}

export function measureFile(root: string, file: string): Measurement[] {
  const text = readFileSync(path.join(root, file), 'utf8');
  return scriptsOf(file, text).flatMap(measureScript);
}

export function findViolations(root: string, config: FunctionLengthConfig): Measurement[] {
  const files = listRepositoryFiles(root).filter((file) => isProductionFile(file, config));
  const measured = files.flatMap((file) => measureFile(root, file));
  return measured.filter((measurement) => measurement.length > config.limit);
}
