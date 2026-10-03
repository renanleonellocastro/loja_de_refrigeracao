import { describe, expect, it } from 'vitest';
import { BRAZILIAN_STATES, digits, isValidCep, isValidCpf, isValidPhone } from './validators.js';

describe('validators', () => {
  it.each([
    ['529.982.247-25', true],
    ['52998224725', true],
    ['111.444.777-35', true],
    ['529.982.247-24', false],
    ['529.982.247-15', false],
    ['111.111.111-11', false],
    ['1234', false],
    ['10000000108', true],
  ])('isValidCpf(%s) is %s', (cpf, expected) => {
    expect(isValidCpf(cpf)).toBe(expected);
  });

  it.each([
    ['(19) 3804-1658', true],
    ['(19) 99999-0001', true],
    ['(19) 89999-0001', false],
    ['(01) 3804-1658', false],
    ['3804-1658', false],
  ])('isValidPhone(%s) is %s', (phone, expected) => {
    expect(isValidPhone(phone)).toBe(expected);
  });

  it('validates CEP and strips digits', () => {
    expect(isValidCep('13800-061')).toBe(true);
    expect(isValidCep('1380006')).toBe(false);
    expect(digits('a1b2')).toBe('12');
    expect(BRAZILIAN_STATES).toContain('SP');
  });
});
