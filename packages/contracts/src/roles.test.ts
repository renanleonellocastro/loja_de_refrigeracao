import { describe, expect, it } from 'vitest';
import { ACTORS, ROLE_LABELS, isRole } from './roles.js';

describe('roles', () => {
  it('labels every actor in Portuguese', () => {
    expect(ACTORS.map((actor) => ROLE_LABELS[actor])).toEqual([
      'Visitante',
      'Super usuário',
      'Gerente',
      'Colaborador',
      'Cliente',
    ]);
  });

  it.each([
    ['ADMIN', true],
    ['CLIENT', true],
    ['GUEST', false],
    ['admin', false],
    [4, false],
    [undefined, false],
  ])('isRole(%s) is %s', (value, expected) => {
    expect(isRole(value)).toBe(expected);
  });
});
