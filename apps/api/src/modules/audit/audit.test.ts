import { describe, expect, it } from 'vitest';
import { useTestApp } from '../../../test/harness.js';
import { recordAudit } from './service.js';

describe('audit trail', () => {
  const t = useTestApp();

  it('lists entries newest first with filters for the super user', async () => {
    const { headers, user } = await t.as('ADMIN');
    await recordAudit(t.db, {
      actorId: user.id,
      action: 'product.create',
      resourceType: 'product',
      resourceId: 1,
      after: { name: 'Geladeira' },
      ip: '1.1.1.1',
    });
    await recordAudit(t.db, {
      actorId: null,
      action: 'order.cancel',
      resourceType: 'order',
      resourceId: null,
    });
    await recordAudit(t.db, { actorId: user.id, action: 'user.delete', resourceType: 'user' });

    const all = await t.app.inject({ method: 'GET', url: '/api/v1/audit-logs', headers });
    expect(all.statusCode).toBe(200);
    expect(all.json().meta).toEqual({ page: 1, pageSize: 20, total: 3 });
    expect(all.json().data[0]).toMatchObject({ action: 'user.delete', resourceId: null, before: null });

    const filtered = await t.app.inject({
      method: 'GET',
      url: `/api/v1/audit-logs?actorId=${user.id}&resourceType=product&from=2000-01-01&to=2100-01-01`,
      headers,
    });
    expect(filtered.json().data).toHaveLength(1);
    expect(filtered.json().data[0]).toMatchObject({
      resourceId: '1',
      after: { name: 'Geladeira' },
      ip: '1.1.1.1',
    });
  });
});
