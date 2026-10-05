import { describe, expect, it } from 'vitest';
import { FixedClock, MINUTE, systemClock } from './clock.js';
import { assertIfMatch, etagFor } from './concurrency.js';
import { AppError, conflict, forbidden, notFound, tooManyRequests, unauthorized } from './errors.js';
import { pageOf, pageQuerySchema, paginated, toLimitOffset } from './pagination.js';
import { dateInput, emailSchema } from './schemas.js';
import { formatBrl, formatDateBr, normalizeEmail, normalizeText, onlyDigits, slugify } from './text.js';
import { z } from 'zod';

describe('errors', () => {
  it('builds RFC 9457 problems', () => {
    expect(notFound().toProblem()).toEqual({
      type: 'https://refrigeracaocastro.com.br/problems/not-found',
      title: 'Não encontrado',
      status: 404,
      detail: 'O recurso não foi encontrado.',
    });
    expect(
      conflict('insufficient-stock', 'Estoque insuficiente', undefined, { items: [] }).toProblem(),
    ).toEqual({
      type: 'https://refrigeracaocastro.com.br/problems/insufficient-stock',
      title: 'Estoque insuficiente',
      status: 409,
      items: [],
    });
  });

  it('carries headers and defaults', () => {
    expect(tooManyRequests(60).headers).toEqual({ 'retry-after': '60' });
    expect(unauthorized().status).toBe(401);
    expect(forbidden().message).toBe('Você não tem permissão para esta ação.');
    expect(new AppError(418, 'teapot', 'Bule').message).toBe('Bule');
  });
});

describe('clock', () => {
  it('moves only when told to', () => {
    const clock = new FixedClock(new Date('2026-01-01T00:00:00Z'));
    clock.advance(MINUTE);
    expect(clock.now().toISOString()).toBe('2026-01-01T00:01:00.000Z');
    clock.set(new Date('2027-01-01T00:00:00Z'));
    expect(clock.now().getUTCFullYear()).toBe(2027);
  });

  it('has a system implementation', () => {
    expect(Math.abs(systemClock.now().getTime() - Date.now())).toBeLessThan(1000);
  });
});

describe('text', () => {
  it('normalizes accents, case and spaces', () => {
    expect(normalizeText('  Refrigeração   CASTRO ')).toBe('refrigeracao castro');
  });

  it('creates slugs', () => {
    expect(slugify('Geladeira Brastemp Frost Free 375L!')).toBe('geladeira-brastemp-frost-free-375l');
    expect(slugify('--Ar condicionado--')).toBe('ar-condicionado');
  });

  it('normalizes emails and digits', () => {
    expect(normalizeEmail(' Ana@Exemplo.COM ')).toBe('ana@exemplo.com');
    expect(onlyDigits('(19) 3804-1658')).toBe('1938041658');
  });

  it('formats reais and Brazilian dates', () => {
    expect(formatBrl(123456)).toBe('R$ 1.234,56');
    expect(formatBrl(5)).toBe('R$ 0,05');
    expect(formatDateBr('2026-10-15')).toBe('15/10/2026');
  });

  it('validates emails with Portuguese messages', () => {
    expect(emailSchema.parse(' Ana@Exemplo.com ')).toBe('ana@exemplo.com');
    expect(emailSchema.safeParse(42).error?.issues[0]?.message).toBe('Informe um email válido.');
    expect(emailSchema.safeParse(`${'a'.repeat(250)}@x.com`).error?.issues[0]?.message).toBe(
      'Email longo demais.',
    );
  });
});

describe('pagination', () => {
  it('parses defaults and limits', () => {
    expect(pageQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(pageQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false);
    expect(toLimitOffset({ page: 3, pageSize: 10 })).toEqual({ limit: 10, offset: 20 });
  });

  it('wraps data with metadata', () => {
    expect(pageOf(['a'], { page: 1, pageSize: 20 }, 1)).toEqual({
      data: ['a'],
      meta: { page: 1, pageSize: 20, total: 1 },
    });
    expect(
      paginated(z.string()).parse({ data: ['x'], meta: { page: 1, pageSize: 1, total: 1 } }).data,
    ).toEqual(['x']);
  });
});

describe('optimistic concurrency', () => {
  it('formats weak etags', () => {
    expect(etagFor(3)).toBe('W/"3"');
  });

  it('requires a matching If-Match', () => {
    expect(() => assertIfMatch(undefined, 1)).toThrowError(expect.objectContaining({ status: 428 }));
    expect(() => assertIfMatch('', 1)).toThrowError(expect.objectContaining({ status: 428 }));
    expect(() => assertIfMatch('W/"1"', 2)).toThrowError(expect.objectContaining({ status: 412 }));
    expect(() => assertIfMatch('W/"1", W/"2"', 2)).not.toThrow();
    expect(() => assertIfMatch('*', 9)).not.toThrow();
  });
});

describe('dateInput', () => {
  // Found by Schemathesis: "0.5" used to be coerced into a date.
  it('accepts ISO 8601 dates and date-times only', () => {
    const schema = dateInput();
    expect(schema.parse('2026-10-05')).toEqual(new Date('2026-10-05'));
    expect(schema.parse('2026-10-05T12:00:00.000Z')).toEqual(new Date('2026-10-05T12:00:00.000Z'));
    expect(schema.parse('2026-10-05T09:00-03:00')).toEqual(new Date('2026-10-05T12:00:00.000Z'));
    expect(schema.safeParse('0.5').success).toBe(false);
    expect(schema.safeParse('2026-13-45').error?.issues[0]?.message).toBe('Data inválida.');
  });
});
