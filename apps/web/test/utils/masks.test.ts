import { describe, expect, it } from 'vitest';
import {
  MASKS,
  formatCep,
  formatCnpj,
  formatCpf,
  formatMoney,
  formatPhone,
  isValidCep,
  isValidCnpj,
  isValidCpf,
  isValidPhone,
  onlyDigits,
  parseMoney,
} from '~/utils/masks';

describe('masks', () => {
  it('keeps only digits', () => {
    expect(onlyDigits('a1.2-3 b')).toBe('123');
  });

  it('formats CPF progressively and stops at 11 digits', () => {
    expect(formatCpf('')).toBe('');
    expect(formatCpf('529')).toBe('529');
    expect(formatCpf('5299')).toBe('529.9');
    expect(formatCpf('52998224725')).toBe('529.982.247-25');
    expect(formatCpf('5299822472599')).toBe('529.982.247-25');
  });

  it('formats CNPJ', () => {
    expect(formatCnpj('63060560000151')).toBe('63.060.560/0001-51');
    expect(formatCnpj('630')).toBe('63.0');
  });

  it('formats landlines and mobiles', () => {
    expect(formatPhone('1938041658')).toBe('(19) 3804-1658');
    expect(formatPhone('19998765432')).toBe('(19) 99876-5432');
    expect(formatPhone('19')).toBe('(19');
  });

  it('formats CEP', () => {
    expect(formatCep('13800061')).toBe('13800-061');
  });

  it('validates CPF check digits', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224724')).toBe(false);
    expect(isValidCpf('52998224715')).toBe(false);
    expect(isValidCpf('11111111111')).toBe(false);
    expect(isValidCpf('123')).toBe(false);
    // Check digit rest below 2 becomes 0.
    expect(isValidCpf('00000000191')).toBe(true);
    expect(isValidCpf('10000000108')).toBe(true);
  });

  it('validates CNPJ check digits', () => {
    expect(isValidCnpj('63.060.560/0001-51')).toBe(true);
    expect(isValidCnpj('63060560000152')).toBe(false);
    expect(isValidCnpj('63060560000141')).toBe(false);
    expect(isValidCnpj('00000000000000')).toBe(false);
    expect(isValidCnpj('1')).toBe(false);
  });

  it('validates phones and CEP', () => {
    expect(isValidPhone('(19) 3804-1658')).toBe(true);
    expect(isValidPhone('19998765432')).toBe(true);
    expect(isValidPhone('19398765432')).toBe(false);
    expect(isValidPhone('199')).toBe(false);
    expect(isValidCep('13800-061')).toBe(true);
    expect(isValidCep('1380')).toBe(false);
  });

  it('formats cents as reais', () => {
    expect(formatMoney(123456)).toBe('R$ 1.234,56');
    expect(formatMoney(0)).toBe('R$ 0,00');
    expect(formatMoney(5)).toBe('R$ 0,05');
  });

  it('parses typed money as cents', () => {
    expect(parseMoney('R$ 1.234,56')).toBe(123456);
    expect(parseMoney('R$ 0,005')).toBe(5);
    expect(parseMoney('')).toBe(0);
    expect(parseMoney('R$ 0,00')).toBe(0);
  });

  it('describes each document mask', () => {
    expect(MASKS.cpf.format('52998224725')).toBe('529.982.247-25');
    expect(MASKS.phone.inputmode).toBe('tel');
    expect(MASKS.cep.maxLength).toBe(9);
  });
});
