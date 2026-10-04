import { describe, expect, it } from 'vitest';
import {
  addressFromApi,
  addressToApi,
  emptyAddress,
  formatAddress,
  isAddressBlank,
  validateAddress,
} from '~/utils/address';
import { ApiError, problemToError, toApiError, unwrap } from '~/utils/api-error';
import { formatDate, formatDateTime } from '~/utils/masks';
import { PRIVATE_ROUTES } from '~/utils/routes';
import { accountHomeFor, firstName, landingFor, safeRedirect } from '~/utils/session';
import { validateNewPassword, validatePerson } from '~/utils/validation';

const FILLED = {
  cep: '13800061',
  street: 'Rua Doutor Ulhoa Cintra',
  number: '91',
  complement: '',
  district: 'Centro',
  city: 'Mogi Mirim',
  state: 'SP',
};

describe('api errors', () => {
  it('builds messages, codes and field errors from problems', () => {
    const error = problemToError(422, {
      type: 'https://x/problemas/validation',
      detail: 'Confira os campos.',
      errors: [
        { path: 'email', message: 'Email inválido.' },
        { path: 'email', message: 'Segunda mensagem.' },
      ],
    });
    expect(error).toMatchObject({ status: 422, code: 'validation', message: 'Confira os campos.' });
    expect(error.fields).toEqual({ email: 'Email inválido.' });
    expect(error.hasFieldErrors).toBe(true);
    expect(problemToError(409, { title: 'Conflito' }).message).toBe('Conflito');
    expect(problemToError(400, {}).message).toContain('Algo deu errado');
    expect(problemToError(500, { detail: 'stack' }).message).toContain('Algo deu errado');
    const empty = problemToError(400, null);
    expect(empty.code).toBe('');
    expect(empty.hasFieldErrors).toBe(false);
  });

  it('turns anything else into a network error', () => {
    const known = new ApiError(404, 'Não achamos.');
    expect(toApiError(known)).toBe(known);
    expect(toApiError(new TypeError('fetch failed'))).toMatchObject({ status: 0, code: 'network' });
    expect(new ApiError(400, 'x').code).toBe('');
  });

  it('unwraps results', async () => {
    const ok = new Response(null, { status: 200 });
    await expect(unwrap(Promise.resolve({ data: 1, response: ok }))).resolves.toBe(1);
    const bad = new Response(null, { status: 404 });
    await expect(unwrap(Promise.resolve({ error: { detail: 'Sumiu.' }, response: bad }))).rejects.toThrow(
      'Sumiu.',
    );
    await expect(unwrap(Promise.reject(new TypeError('offline')))).rejects.toMatchObject({ code: 'network' });
  });
});

describe('session helpers', () => {
  it('picks the landing page and the account home by role', () => {
    expect(landingFor('CLIENT')).toBe('/');
    expect(landingFor('EMPLOYEE')).toBe('/hoje');
    expect(landingFor('MANAGER')).toBe('/painel');
    expect(accountHomeFor('CLIENT')).toBe('/perfil');
    expect(accountHomeFor('ADMIN')).toBe('/painel');
  });

  it('accepts only internal redirects', () => {
    expect(safeRedirect('/perfil?aba=seguranca')).toBe('/perfil?aba=seguranca');
    expect(safeRedirect('//evil.com')).toBeNull();
    expect(safeRedirect('https://evil.com')).toBeNull();
    expect(safeRedirect('/entrar')).toBeNull();
    expect(safeRedirect(['/x'])).toBeNull();
  });

  it('finds the first name', () => {
    expect(firstName('  Marina Gerente ')).toBe('Marina');
    expect(PRIVATE_ROUTES).toContain('/perfil');
  });

  it('formats dates in the store time zone', () => {
    expect(formatDate('2026-10-03T15:00:00.000Z')).toBe('3 de outubro de 2026');
    expect(formatDateTime('2026-10-03T17:30:00.000Z')).toBe('03/10/2026, 14:30');
  });
});

describe('addresses', () => {
  it('converts between the form and the API', () => {
    expect(addressFromApi(null)).toEqual(emptyAddress());
    expect(addressFromApi({ ...FILLED, complement: null }).complement).toBe('');
    expect(addressFromApi({ ...FILLED, complement: 'Fundos' }).complement).toBe('Fundos');
    expect(addressToApi(emptyAddress())).toBeNull();
    expect(addressToApi(FILLED)).toEqual({ ...FILLED, complement: null });
    expect(addressToApi({ ...FILLED, complement: ' Apto 2 ' })!.complement).toBe('Apto 2');
    expect(isAddressBlank({ ...emptyAddress(), city: ' ' })).toBe(true);
  });

  it('validates a filled or required address', () => {
    expect(validateAddress(emptyAddress(), false)).toEqual({});
    expect(validateAddress(FILLED, true)).toEqual({});
    const errors = validateAddress(emptyAddress(), true, 'endereco');
    expect(Object.keys(errors)).toEqual([
      'endereco.cep',
      'endereco.street',
      'endereco.number',
      'endereco.district',
      'endereco.city',
      'endereco.state',
    ]);
  });

  it('formats one line', () => {
    expect(formatAddress(null)).toBe('Não informado');
    expect(formatAddress({ ...FILLED, complement: 'Fundos' })).toBe(
      'Rua Doutor Ulhoa Cintra, 91, Fundos, Centro, Mogi Mirim/SP, CEP 13800-061',
    );
  });
});

describe('person and password checks', () => {
  const person = { name: 'Carla Cliente', email: 'carla@exemplo.com', phone: '19999998888', cpf: '' };

  it('checks name, email, phone and CPF', () => {
    expect(validatePerson(person, { cpfRequired: false })).toEqual({});
    const errors = validatePerson({ name: 'Al', email: 'x', phone: '1', cpf: '' }, { cpfRequired: true });
    expect(Object.keys(errors)).toEqual(['name', 'email', 'phone', 'cpf']);
    expect(validatePerson({ ...person, phone: '' }, { cpfRequired: false, phoneRequired: false })).toEqual(
      {},
    );
    expect(validatePerson({ ...person, cpf: '1234567890' }, { cpfRequired: false }).cpf).toBe(
      'CPF incompleto: falta 1 número.',
    );
    expect(validatePerson({ ...person, cpf: '123' }, { cpfRequired: false }).cpf).toBe(
      'CPF incompleto: faltam 8 números.',
    );
    expect(validatePerson({ ...person, cpf: '11111111111' }, { cpfRequired: false }).cpf).toContain(
      'não existe',
    );
    expect(validatePerson({ ...person, cpf: '52998224725' }, { cpfRequired: true })).toEqual({});
  });

  it('checks the new password and its confirmation', () => {
    expect(validateNewPassword('Senha-Forte-1', 'Senha-Forte-1', 'p', 'c')).toEqual({});
    expect(Object.keys(validateNewPassword('curta', 'outra', 'p', 'c'))).toEqual(['p', 'c']);
  });
});
