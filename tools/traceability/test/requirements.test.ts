import { describe, expect, it } from 'vitest';
import { parseRequirements } from '../src/requirements.js';

describe('parseRequirements', () => {
  it('reads each requirement line and drops the use case reference', () => {
    const markdown = [
      '# Requisitos',
      '',
      '* **RF-01** Cadastrar cliente. (UC Cadastrar Cliente)',
      '  * **RF-02** Recuperar senha (UCs Recuperar Senha, Alterar Senha)',
      '* **RF-03** Alterar senha.',
      '* **RNF-01** Not a functional requirement.',
    ].join('\n');

    expect(parseRequirements(markdown)).toEqual([
      { id: 'RF-01', text: 'Cadastrar cliente.' },
      { id: 'RF-02', text: 'Recuperar senha' },
      { id: 'RF-03', text: 'Alterar senha.' },
    ]);
  });
});
