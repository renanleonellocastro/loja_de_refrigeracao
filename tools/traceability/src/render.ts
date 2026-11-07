import type { Matrix, MatrixRow } from './matrix.js';
import type { TaggedTest } from './tests.js';

const HEADER = [
  '# Rastreabilidade: requisitos e testes E2E',
  '',
  'Gerado por `make traceability` a partir de [REQUISITOS.md](REQUISITOS.md) e das tags `@RF-NN` dos testes',
  'Playwright em `apps/e2e/tests`. Não edite à mão: o job de qualidade da CI gera de novo e falha quando o',
  'arquivo está desatualizado ou quando um requisito fica sem teste.',
  '',
  '| Requisito | O que pede | Testes E2E |',
  '| --- | --- | --- |',
];

function escapeCell(text: string): string {
  return text.replaceAll('|', '\\|');
}

function testCell(test: TaggedTest): string {
  return `[${test.file}](../apps/e2e/tests/${test.file}): ${escapeCell(test.title)}`;
}

function rowLine({ requirement, tests }: MatrixRow): string {
  const cell = tests.length === 0 ? '**sem teste**' : tests.map(testCell).join('<br>');
  return `| ${requirement.id} | ${escapeCell(requirement.text)} | ${cell} |`;
}

/** The matrix as the Markdown document committed at docs/RASTREABILIDADE.md. */
export function renderMatrix(matrix: Matrix): string {
  return [...HEADER, ...matrix.rows.map(rowLine), ''].join('\n');
}
