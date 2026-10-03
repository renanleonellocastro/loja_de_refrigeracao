import { describe, expect, it } from 'vitest';
import { auditLogs } from '../../infra/db/schema.js';
import { useTestApp } from '../../../test/harness.js';
import { defaultStockMin, isOpenAt } from './service.js';

const WEEK = {
  '0': null,
  '1': { opens: '09:00', closes: '18:00' },
  '2': { opens: '09:00', closes: '18:00' },
  '3': { opens: '09:00', closes: '18:00' },
  '4': { opens: '09:00', closes: '18:00' },
  '5': { opens: '09:00', closes: '18:00' },
  '6': null,
};

describe('store', () => {
  const t = useTestApp();

  it('knows when the store is open in São Paulo time', () => {
    expect(isOpenAt(WEEK, new Date('2026-10-05T12:00:00Z'))).toBe(true); // Monday 09:00
    expect(isOpenAt(WEEK, new Date('2026-10-05T11:59:00Z'))).toBe(false); // Monday 08:59
    expect(isOpenAt(WEEK, new Date('2026-10-05T21:00:00Z'))).toBe(false); // Monday 18:00
    expect(isOpenAt(WEEK, new Date('2026-10-04T15:00:00Z'))).toBe(false); // Sunday
  });

  it('publishes the real store data, cacheable', async () => {
    const response = await t.app.inject({ method: 'GET', url: '/api/v1/store' });
    expect(response.headers['cache-control']).toBe('public, max-age=300');
    expect(response.json()).toMatchObject({
      name: 'Refrigeração Castro',
      cnpj: '63060560000151',
      phone: '1938041658',
      address: { street: 'Rua Doutor Ulhoa Cintra', number: '91', city: 'Mogi Mirim' },
      openNow: true,
    });
    expect(response.json().notificationEmails).toBeUndefined();
    expect(await defaultStockMin(t.db)).toBe(1);
  });

  it('lets the super user configure the store with an audit trail', async () => {
    const { headers } = await t.as('ADMIN');
    const settings = await t.app.inject({ method: 'GET', url: '/api/v1/store/settings', headers });
    expect(settings.json()).toMatchObject({ notificationEmails: [], defaultStockMin: 1 });
    const updated = await t.app.inject({
      method: 'PATCH',
      url: '/api/v1/store',
      headers,
      payload: {
        whatsapp: '(19) 99999-1658',
        notificationEmails: ['Loja@Exemplo.com.br'],
        openingHours: { ...WEEK, '6': { opens: '08:00', closes: '12:00' } },
        address: {
          cep: '13800-061',
          street: 'Rua Doutor Ulhoa Cintra',
          number: '91',
          complement: null,
          district: 'Centro',
          city: 'Mogi Mirim',
          state: 'SP',
        },
      },
    });
    expect(updated.json()).toMatchObject({
      whatsapp: '19999991658',
      notificationEmails: ['loja@exemplo.com.br'],
    });
    expect((await t.db.select().from(auditLogs))[0]!.action).toBe('store.update');
    const invalid = await t.app.inject({
      method: 'PATCH',
      url: '/api/v1/store',
      headers,
      payload: { openingHours: { '1': { opens: '18:00', closes: '09:00' } }, phone: '123' },
    });
    expect(invalid.statusCode).toBe(422);
  });
});
