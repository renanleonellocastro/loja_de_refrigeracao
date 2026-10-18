import { parse, type SFCScriptBlock } from '@vue/compiler-sfc';
import type { ScriptSource } from './measurement.js';

const SCRIPT_LANGUAGES: Readonly<Record<string, ScriptSource['language']>> = {
  ts: 'ts',
  tsx: 'tsx',
  js: 'js',
  jsx: 'jsx',
};
const DEFAULT_LANGUAGE = 'js';

function languageOf(block: SFCScriptBlock): ScriptSource['language'] {
  return SCRIPT_LANGUAGES[block.lang ?? DEFAULT_LANGUAGE] ?? DEFAULT_LANGUAGE;
}

function toScriptSource(path: string, block: SFCScriptBlock): ScriptSource {
  return { path, text: block.content, language: languageOf(block), lineOffset: block.loc.start.line - 1 };
}

/** The `<script>` and `<script setup>` blocks of a single file component; templates hold no functions. */
export function vueScripts(path: string, text: string): ScriptSource[] {
  const { descriptor } = parse(text, { filename: path, sourceMap: false });
  const blocks = [descriptor.script, descriptor.scriptSetup].filter((block) => block !== null);
  return blocks.map((block) => toScriptSource(path, block));
}
