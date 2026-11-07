import { describe, expect, it } from 'vitest';
import { buildMatrix } from '../src/matrix.js';
import { renderMatrix } from '../src/render.js';

describe('renderMatrix', () => {
  it('renders a row per requirement with links to the tests and marks the gaps', () => {
    const matrix = buildMatrix(
      [
        { id: 'RF-01', text: 'Entrar | sair' },
        { id: 'RF-02', text: 'Dois' },
      ],
      [
        { file: 'a.spec.ts', title: 'Conta › entra', requirements: ['RF-01'] },
        { file: 'b.spec.ts', title: 'sai', requirements: ['RF-01'] },
      ],
    );

    const lines = renderMatrix(matrix).split('\n');

    expect(lines[0]).toBe('# Rastreabilidade: requisitos e testes E2E');
    expect(lines).toContain(
      '| RF-01 | Entrar \\| sair | [a.spec.ts](../apps/e2e/tests/a.spec.ts): Conta › entra<br>' +
        '[b.spec.ts](../apps/e2e/tests/b.spec.ts): sai |',
    );
    expect(lines).toContain('| RF-02 | Dois | **sem teste** |');
    expect(lines.at(-1)).toBe('');
  });
});
