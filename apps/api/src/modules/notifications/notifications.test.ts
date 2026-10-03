import { describe, expect, it } from 'vitest';
import { notifications, storeSettings } from '../../infra/db/schema.js';
import { useTestApp } from '../../../test/harness.js';
import { notifyManagement, notifyUser, notifyUserById } from './service.js';

describe('notifications', () => {
  const t = useTestApp();

  it('creates an in-app notification and an email in the same call', async () => {
    const user = await t.createUser('CLIENT');
    await notifyUser(t.ctx, t.db, user, {
      type: 'order.ready',
      subject: 'Pedido pronto',
      paragraphs: ['Pode retirar na loja.'],
      path: '/minha-conta/pedidos/1',
      actionLabel: 'Ver pedido',
    });
    await notifyUser(t.ctx, t.db, user, {
      type: 'info',
      subject: 'Sem link',
      heading: 'Olá',
      paragraphs: ['a', 'b'],
    });
    const rows = await t.db.select().from(notifications);
    expect(rows.map((r) => [r.title, r.body, r.link])).toEqual([
      ['Pedido pronto', 'Pode retirar na loja.', '/minha-conta/pedidos/1'],
      ['Sem link', 'a b', null],
    ]);
    await t.deliverEmails();
    expect(t.mailer.sent[0]!.text).toContain('Ver pedido: http://localhost:3000/minha-conta/pedidos/1');
    expect(t.mailer.sent[1]!.text).not.toContain('http://localhost:3000/');
  });

  it('skips removed accounts and notifies management plus the store addresses once', async () => {
    await notifyUserById(t.ctx, t.db, 999999, { type: 'x', subject: 'Ninguém', paragraphs: [] });
    const author = await t.createUser('MANAGER');
    const admin = await t.createUser('ADMIN', { email: 'dono@exemplo.com.br' });
    await t.db
      .update(storeSettings)
      .set({ notificationEmails: ['loja@exemplo.com.br', 'DONO@exemplo.com.br'] });
    await notifyManagement(t.ctx, t.db, author.id, {
      type: 'x',
      subject: 'Novo pedido',
      paragraphs: ['RC-1'],
      path: '/pedidos/1',
    });
    await notifyManagement(t.ctx, t.db, author.id, { type: 'x', subject: 'Sem caminho', paragraphs: [] });
    await t.deliverEmails();
    const to = t.mailer.sent.map((m) => `${m.to} ${m.subject}`);
    expect(to).toEqual([
      `${admin.email} Novo pedido`,
      'loja@exemplo.com.br Novo pedido',
      `${admin.email} Sem caminho`,
      'loja@exemplo.com.br Sem caminho',
    ]);
    expect(t.mailer.sent[1]!.text).toContain('Olá, equipe!');
    expect(t.mailer.sent[3]!.text).not.toContain('Ver detalhes');
  });

  it('lists, counts and marks notifications as read for their owner only', async () => {
    const { headers, user } = await t.as('CLIENT');
    const other = await t.as('CLIENT');
    for (const subject of ['Um', 'Dois', 'Três']) {
      await notifyUser(t.ctx, t.db, user, { type: 'x', subject, paragraphs: [] });
      t.clock.advance(1000);
    }
    const list = await t.app.inject({ method: 'GET', url: '/api/v1/me/notifications?pageSize=2', headers });
    expect(list.json().meta).toEqual({ page: 1, pageSize: 2, total: 3, unread: 3 });
    expect(list.json().data.map((n: { title: string }) => n.title)).toEqual(['Três', 'Dois']);
    const id = list.json().data[0].id;
    expect(
      (
        await t.app.inject({
          method: 'POST',
          url: `/api/v1/me/notifications/${id}/read`,
          headers: other.headers,
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await t.app.inject({ method: 'POST', url: `/api/v1/me/notifications/${id}/read`, headers }))
        .statusCode,
    ).toBe(204);
    const unread = await t.app.inject({
      method: 'GET',
      url: '/api/v1/me/notifications?unread=true',
      headers,
    });
    expect(unread.json().meta).toMatchObject({ total: 2, unread: 2 });
    await t.app.inject({ method: 'POST', url: '/api/v1/me/notifications/read-all', headers });
    const after = await t.app.inject({ method: 'GET', url: '/api/v1/me/notifications', headers });
    expect(after.json().meta.unread).toBe(0);
  });
});
