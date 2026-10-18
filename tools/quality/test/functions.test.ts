import { describe, expect, it } from 'vitest';
import { measureScript } from '../src/functions.js';
import type { ScriptSource } from '../src/measurement.js';

function measure(text: string, overrides: Partial<ScriptSource> = {}) {
  return measureScript({ path: 'file.ts', text, language: 'ts', lineOffset: 0, ...overrides });
}

function lengths(text: string, overrides: Partial<ScriptSource> = {}) {
  return measure(text, overrides).map(({ name, length }) => [name, length]);
}

describe('measureScript', () => {
  it('counts block bodies without blank or comment only lines', () => {
    const text = [
      'function sum(a: number) {',
      '  // why',
      '',
      '  /* note */',
      '  const b = a;',
      '  return b;',
      '}',
    ];

    expect(lengths(text.join('\n'))).toEqual([['sum', 2]]);
  });

  it('counts expression bodies from the line after the arrow', () => {
    const text = ['const pick = (a: number) =>', '  a', '    + 1;', 'const one = () => 1;'];

    expect(lengths(text.join('\n'))).toEqual([
      ['pick', 2],
      ['one', 0],
    ]);
  });

  it('counts parenthesized bodies between the parentheses', () => {
    const text = ['const view = () => (', '  <div>', '    {/* hint */}', '  </div>', ');'];

    expect(lengths(text.join('\n'), { language: 'tsx', path: 'view.tsx' })).toEqual([['view', 2]]);
  });

  it('names methods, constructors and accessors inside their class', () => {
    const text = [
      'class Cart {',
      '  constructor() {}',
      '  get size() { return 1; }',
      '  add(): void {}',
      '  total = () => 0;',
      '  abstract(): void;',
      '}',
    ];

    expect(measure(text.join('\n')).map(({ name }) => name)).toEqual([
      'Cart.constructor',
      'Cart.size',
      'Cart.add',
      'Cart.total',
    ]);
  });

  it('names callbacks after their callee and the variable that receives them', () => {
    const text = [
      'const total = computed(() => 1);',
      'items',
      '  .map(function () {});',
      'const { a,',
      '  b } = use(() => 0);',
      'run(() => 0);',
      'export default () => {};',
      'const routes = { list: () => [] };',
    ];

    expect(measure(text.join('\n')).map(({ name }) => name)).toEqual([
      'total=computed(callback)',
      'map(callback)',
      '{a,b}=use(callback)',
      'run(callback)',
      'anonymous',
      'list',
    ]);
  });

  it('nests names of inner functions and keeps multi line template strings', () => {
    const text = ['function outer() {', '  const inner = () => `', 'a', '', 'b`;', '}'];

    expect(lengths(text.join('\n'), { language: 'js', path: 'file.js' })).toEqual([
      ['outer', 3],
      ['outer.inner', 2],
    ]);
  });

  it('adds the line offset of an embedded script', () => {
    const [measurement] = measure('function late() {}', { lineOffset: 9 });

    expect(measurement?.line).toBe(10);
  });

  it('parses jsx files', () => {
    expect(lengths('const tag = () => <b />;', { language: 'jsx', path: 'tag.jsx' })).toEqual([['tag', 0]]);
  });
});
