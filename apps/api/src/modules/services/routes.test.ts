import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { appointments, auditLogs, quotes, serviceRequests, serviceTypes } from '../../infra/db/schema.js';
import { jpeg } from '../../../test/images.js';
import { multipart } from '../../../test/multipart.js';
import { useTestApp } from '../../../test/harness.js';
import { saveAddress } from '../users/service.js';

const ADDRESS = {
  cep: '13800061',
  street: 'Rua Doutor Ulhoa Cintra',
  number: '91',
  complement: null,
  district: 'Centro',
  city: 'Mogi Mirim',
  state: 'SP',
};

// START is 2026-10-05 12:00 UTC (09:00 in São Paulo).
function withHeaders(body: ReturnType<typeof multipart>, headers: Record<string, string>) {
  return { payload: body.payload, headers: { ...headers, ...body.headers } };
}

const WINDOWS = [
  { day: '2026-10-07', period: 'MORNING' },
  { day: '2026-10-08', period: 'AFTERNOON' },
];

describe('service routes', () => {
  const t = useTestApp();

  async function serviceType(overrides: Partial<typeof serviceTypes.$inferInsert> = {}) {
    const [row] = await t.db
      .insert(serviceTypes)
      .values({ name: `Conserto ${Math.random()}`, estimatedMinutes: 120, ...overrides })
      .returning();
    return row!;
  }

  async function customerWithAddress() {
    const session = await t.as('CLIENT');
    await saveAddress(t.db, session.user.id, ADDRESS, t.clock.now());
    return session;
  }

  async function createRequest(headers: Record<string, string>, extra: Record<string, unknown> = {}) {
    const type = await serviceType();
    const response = await t.app.inject({
      method: 'POST',
      url: '/api/v1/service-requests',
      headers,
      payload: {
        serviceTypeId: type.id,
        productKind: 'Geladeira duplex',
        brand: 'Brastemp',
        problem: 'Não está gelando a parte de baixo.',
        windows: WINDOWS,
        ...extra,
      },
    });
    return response;
  }

  describe('service types', () => {
    it('lists active types publicly and inactive ones only to the super user', async () => {
      await serviceType({ name: 'Ativo', position: 2 });
      const inactive = await serviceType({ name: 'Inativo', active: false, position: 1 });
      const pub = await t.app.inject({ method: 'GET', url: '/api/v1/service-types?includeInactive=true' });
      expect(pub.json().map((s: { name: string }) => s.name)).toEqual(['Ativo']);
      const { headers } = await t.as('ADMIN');
      const all = await t.app.inject({
        method: 'GET',
        url: '/api/v1/service-types?includeInactive=true',
        headers,
      });
      expect(all.json().map((s: { name: string }) => s.name)).toEqual(['Inativo', 'Ativo']);
      expect(
        (await t.app.inject({ method: 'GET', url: `/api/v1/service-types/${inactive.id}` })).statusCode,
      ).toBe(404);
      expect(
        (await t.app.inject({ method: 'GET', url: `/api/v1/service-types/${inactive.id}`, headers }))
          .statusCode,
      ).toBe(200);
    });

    it('creates, renames, refuses duplicates and audits', async () => {
      const { headers } = await t.as('ADMIN');
      const created = await t.app.inject({
        method: 'POST',
        url: '/api/v1/service-types',
        headers,
        payload: { name: 'Limpeza de ar condicionado', estimatedMinutes: 90 },
      });
      expect(created.statusCode).toBe(201);
      expect(created.json()).toMatchObject({ description: '', active: true, estimatedMinutes: 90 });
      const duplicate = await t.app.inject({
        method: 'POST',
        url: '/api/v1/service-types',
        headers,
        payload: { name: 'LIMPEZA DE AR CONDICIONADO' },
      });
      expect(duplicate.json()).toMatchObject({ status: 409, title: 'Serviço já cadastrado' });
      const other = await serviceType({ name: 'Outro serviço' });
      const clash = await t.app.inject({
        method: 'PATCH',
        url: `/api/v1/service-types/${other.id}`,
        headers,
        payload: { name: 'Limpeza de ar condicionado' },
      });
      expect(clash.statusCode).toBe(409);
      const onlyMinutes = await t.app.inject({
        method: 'PATCH',
        url: `/api/v1/service-types/${other.id}`,
        headers,
        payload: { estimatedMinutes: 45 },
      });
      expect(onlyMinutes.json().estimatedMinutes).toBe(45);
      const renamed = await t.app.inject({
        method: 'PATCH',
        url: `/api/v1/service-types/${created.json().id}`,
        headers,
        payload: { name: 'Limpeza de ar condicionado', description: 'Higienização completa' },
      });
      expect(renamed.json().description).toBe('Higienização completa');
      const missing = await t.app.inject({
        method: 'PATCH',
        url: '/api/v1/service-types/999999',
        headers,
        payload: {},
      });
      expect(missing.statusCode).toBe(404);
      const actions = (await t.db.select().from(auditLogs)).map((a) => a.action);
      expect(actions).toEqual(['serviceType.create', 'serviceType.update', 'serviceType.update']);
    });

    it('deletes unused types and deactivates used ones', async () => {
      const { headers, user } = await t.as('ADMIN');
      const unused = await serviceType();
      const used = await serviceType();
      await t.db
        .insert(quotes)
        .values({ customerId: user.id, serviceTypeId: used.id, description: 'x', createdById: user.id });
      const del = await t.app.inject({
        method: 'DELETE',
        url: `/api/v1/service-types/${unused.id}`,
        headers,
      });
      expect(del.json()).toEqual({ result: 'deleted' });
      const deact = await t.app.inject({
        method: 'DELETE',
        url: `/api/v1/service-types/${used.id}`,
        headers,
      });
      expect(deact.json()).toEqual({ result: 'deactivated' });
      const [row] = await t.db.select().from(serviceTypes).where(eq(serviceTypes.id, used.id));
      expect(row!.active).toBe(false);
      expect(
        (await t.app.inject({ method: 'DELETE', url: '/api/v1/service-types/999999', headers })).statusCode,
      ).toBe(404);
    });
  });

  describe('POST /service-requests', () => {
    it('creates a request with the saved address and emails the customer and the management', async () => {
      const manager = await t.createUser('MANAGER');
      const { headers, user } = await customerWithAddress();
      const response = await createRequest(headers);
      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        status: 'REQUESTED',
        statusLabel: 'Solicitado',
        address: ADDRESS,
        windows: WINDOWS,
        customer: { id: user.id },
        appointment: null,
        canCancel: true,
      });
      await t.deliverEmails();
      expect(t.lastEmailTo(user.email)?.subject).toBe(`Recebemos sua solicitação nº ${response.json().id}`);
      expect(t.lastEmailTo(manager.email)?.text).toContain('/solicitacoes/');
    });

    it('accepts an explicit address and requires one when the customer has none', async () => {
      const { headers } = await t.as('CLIENT');
      const missing = await createRequest(headers);
      expect(missing.json()).toMatchObject({ status: 422, title: 'Endereço obrigatório' });
      const explicit = await createRequest(headers, {
        address: { ...ADDRESS, cep: '13800-061' },
        brand: '',
        model: 'DF50',
      });
      expect(explicit.json()).toMatchObject({ brand: null, model: 'DF50' });
    });

    it('validates dates: from tomorrow, within 60 days, without repetition', async () => {
      const { headers } = await customerWithAddress();
      const today = await createRequest(headers, { windows: [{ day: '2026-10-05', period: 'MORNING' }] });
      expect(today.json().errors).toEqual([
        { path: 'windows.0.day', message: 'Escolha datas a partir de amanhã.' },
      ]);
      const far = await createRequest(headers, { windows: [{ day: '2026-12-31', period: 'MORNING' }] });
      expect(far.json().detail).toBe('Escolha datas nos próximos 60 dias.');
      const repeated = await createRequest(headers, { windows: [WINDOWS[0], WINDOWS[0]] });
      expect(repeated.json().errors[0].path).toBe('windows.1.day');
      const none = await createRequest(headers, { windows: [] });
      expect(none.statusCode).toBe(422);
    });

    it('refuses inactive service types', async () => {
      const { headers } = await customerWithAddress();
      const type = await serviceType({ active: false });
      const response = await t.app.inject({
        method: 'POST',
        url: '/api/v1/service-requests',
        headers,
        payload: {
          serviceTypeId: type.id,
          productKind: 'Lavadora',
          problem: 'Não centrifuga mais.',
          windows: WINDOWS,
        },
      });
      expect(response.json()).toMatchObject({ status: 422, title: 'Serviço indisponível' });
    });

    it('lets management create on behalf of a customer, with audit, but not customers for others', async () => {
      const customer = await customerWithAddress();
      const { headers } = await t.as('MANAGER');
      const noCustomer = await createRequest(headers);
      expect(noCustomer.json()).toMatchObject({ status: 422, title: 'Cliente obrigatório' });
      const staffTarget = await t.createUser('EMPLOYEE');
      expect((await createRequest(headers, { customerId: staffTarget.id })).statusCode).toBe(404);
      const ok = await createRequest(headers, { customerId: customer.user.id });
      expect(ok.statusCode).toBe(201);
      expect((await t.db.select().from(auditLogs))[0]!.action).toBe('serviceRequest.create');
      const other = await customerWithAddress();
      const forOther = await createRequest(other.headers, { customerId: customer.user.id });
      expect(forOther.statusCode).toBe(403);
      const forSelf = await createRequest(other.headers, { customerId: other.user.id });
      expect(forSelf.statusCode).toBe(201);
    });

    it('is idempotent with the same key', async () => {
      const { headers } = await customerWithAddress();
      const type = await serviceType();
      const payload = {
        serviceTypeId: type.id,
        productKind: 'Freezer',
        problem: 'Faz barulho alto.',
        windows: WINDOWS,
      };
      const h = { ...headers, 'idempotency-key': 'solicitacao-123' };
      await t.app.inject({ method: 'POST', url: '/api/v1/service-requests', headers: h, payload });
      await t.app.inject({ method: 'POST', url: '/api/v1/service-requests', headers: h, payload });
      expect(await t.db.select().from(serviceRequests)).toHaveLength(1);
    });
  });

  describe('visibility and listing', () => {
    it('shows customers only their own requests and staff all of them, with search', async () => {
      const ana = await customerWithAddress();
      const bia = await customerWithAddress();
      const a = await createRequest(ana.headers);
      await createRequest(bia.headers);
      const anaList = await t.app.inject({
        method: 'GET',
        url: '/api/v1/service-requests?q=ignorado',
        headers: ana.headers,
      });
      expect(anaList.json().data.map((r: { id: number }) => r.id)).toEqual([a.json().id]);
      expect(
        (
          await t.app.inject({
            method: 'GET',
            url: `/api/v1/service-requests/${a.json().id}`,
            headers: bia.headers,
          })
        ).statusCode,
      ).toBe(404);

      const { headers } = await t.as('MANAGER');
      const all = await t.app.inject({
        method: 'GET',
        url: '/api/v1/service-requests?status=REQUESTED,APPROVED',
        headers,
      });
      expect(all.json().meta.total).toBe(2);
      const byName = await t.app.inject({
        method: 'GET',
        url: `/api/v1/service-requests?q=${encodeURIComponent(ana.user.name)}`,
        headers,
      });
      expect(byName.json().data).toHaveLength(1);
      const byNumber = await t.app.inject({
        method: 'GET',
        url: `/api/v1/service-requests?q=${a.json().id}`,
        headers,
      });
      expect(byNumber.json().data[0]).toMatchObject({ id: a.json().id, employee: null, scheduledFor: null });
      expect(
        (await t.app.inject({ method: 'GET', url: '/api/v1/service-requests/999999', headers })).statusCode,
      ).toBe(404);
    });

    it('shows employees only the requests assigned to them', async () => {
      const customer = await customerWithAddress();
      const created = await createRequest(customer.headers);
      const tech = await t.as('EMPLOYEE');
      const other = await t.as('EMPLOYEE');
      const id = created.json().id;
      await t.db.update(serviceRequests).set({ status: 'SCHEDULED' }).where(eq(serviceRequests.id, id));
      await t.db.insert(appointments).values({
        serviceRequestId: id,
        employeeId: tech.user.id,
        startsAt: new Date('2026-10-07T12:00:00Z'),
        endsAt: new Date('2026-10-07T14:00:00Z'),
        createdById: tech.user.id,
      });
      const mine = await t.app.inject({
        method: 'GET',
        url: '/api/v1/service-requests',
        headers: tech.headers,
      });
      expect(mine.json().data[0]).toMatchObject({ id, employee: { id: tech.user.id } });
      const detail = await t.app.inject({
        method: 'GET',
        url: `/api/v1/service-requests/${id}`,
        headers: tech.headers,
      });
      expect(detail.json()).toMatchObject({
        appointment: { employee: { id: tech.user.id } },
        canCancel: false,
      });
      expect(
        (await t.app.inject({ method: 'GET', url: `/api/v1/service-requests/${id}`, headers: other.headers }))
          .statusCode,
      ).toBe(404);
      const none = await t.app.inject({
        method: 'GET',
        url: '/api/v1/service-requests',
        headers: other.headers,
      });
      expect(none.json().data).toEqual([]);
    });
  });

  describe('photos', () => {
    it('accepts up to 6 photos while the request is open', async () => {
      const { headers } = await customerWithAddress();
      const id = (await createRequest(headers)).json().id;
      const photo = await jpeg(800, 600);
      const upload = (count: number, h = headers) =>
        t.app.inject({
          method: 'POST',
          url: `/api/v1/service-requests/${id}/photos`,
          ...withHeaders(
            multipart(
              Array.from({ length: count }, (_, i) => ({
                name: 'fotos',
                value: photo,
                filename: `${i}.jpg`,
              })),
            ),
            h,
          ),
        });
      const first = await upload(4);
      expect(first.statusCode).toBe(201);
      expect(first.json()).toHaveLength(4);
      expect((await upload(3)).json()).toMatchObject({ status: 422, title: 'Fotos demais' });

      await t.db.update(serviceRequests).set({ status: 'APPROVED' }).where(eq(serviceRequests.id, id));
      expect((await upload(1)).json()).toMatchObject({ status: 409, title: 'Não é possível enviar fotos' });
      const manager = await t.as('MANAGER');
      expect((await upload(1, manager.headers)).statusCode).toBe(201);
      const detail = await t.app.inject({ method: 'GET', url: `/api/v1/service-requests/${id}`, headers });
      expect(detail.json().photos).toHaveLength(5);
      await t.db.update(serviceRequests).set({ status: 'COMPLETED' }).where(eq(serviceRequests.id, id));
      expect((await upload(1, manager.headers)).statusCode).toBe(409);
      const tech = await t.as('EMPLOYEE');
      expect((await upload(1, tech.headers)).statusCode).toBe(404);
    });
  });

  describe('conversation and decisions', () => {
    it('moves between waiting for the customer and requested as messages go back and forth', async () => {
      const customer = await customerWithAddress();
      const id = (await createRequest(customer.headers)).json().id;
      const { headers, user: manager } = await t.as('MANAGER');
      const ask = await t.app.inject({
        method: 'POST',
        url: `/api/v1/service-requests/${id}/messages`,
        headers,
        payload: { body: 'Qual a voltagem da geladeira?' },
      });
      expect(ask.statusCode).toBe(201);
      expect(ask.json()[0]).toMatchObject({ mine: true, author: { id: manager.id, role: 'MANAGER' } });
      let detail = await t.app.inject({ method: 'GET', url: `/api/v1/service-requests/${id}`, headers });
      expect(detail.json().status).toBe('AWAITING_CUSTOMER');
      await t.deliverEmails();
      expect(t.lastEmailTo(customer.user.email)?.text).toContain('Qual a voltagem da geladeira?');

      const answer = await t.app.inject({
        method: 'POST',
        url: `/api/v1/service-requests/${id}/messages`,
        headers: customer.headers,
        payload: { body: '220V' },
      });
      expect(answer.json().map((m: { mine: boolean }) => m.mine)).toEqual([false, true]);
      detail = await t.app.inject({ method: 'GET', url: `/api/v1/service-requests/${id}`, headers });
      expect(detail.json().status).toBe('REQUESTED');
      await t.deliverEmails();
      expect(t.lastEmailTo(manager.email)?.subject).toBe(`Resposta do cliente na solicitação nº ${id}`);

      const listed = await t.app.inject({
        method: 'GET',
        url: `/api/v1/service-requests/${id}/messages`,
        headers: customer.headers,
      });
      expect(listed.json()).toHaveLength(2);
      const tech = await t.as('EMPLOYEE');
      const techPost = await t.app.inject({
        method: 'POST',
        url: `/api/v1/service-requests/${id}/messages`,
        headers: tech.headers,
        payload: { body: 'oi' },
      });
      expect(techPost.statusCode).toBe(403);
    });

    it('approves with an optional message and then refuses a second approval', async () => {
      const customer = await customerWithAddress();
      const id = (await createRequest(customer.headers)).json().id;
      const { headers } = await t.as('MANAGER');
      const approved = await t.app.inject({
        method: 'POST',
        url: `/api/v1/service-requests/${id}/approval`,
        headers,
        payload: { message: 'Vamos levar a peça.' },
      });
      expect(approved.json()).toMatchObject({ status: 'APPROVED' });
      const again = await t.app.inject({
        method: 'POST',
        url: `/api/v1/service-requests/${id}/approval`,
        headers,
        payload: {},
      });
      expect(again.json()).toMatchObject({ status: 409, title: 'Ação indisponível' });
      const id2 = (await createRequest(customer.headers)).json().id;
      const silent = await t.app.inject({
        method: 'POST',
        url: `/api/v1/service-requests/${id2}/approval`,
        headers,
        payload: {},
      });
      expect(silent.json().status).toBe('APPROVED');
      await t.deliverEmails();
      expect(t.lastEmailTo(customer.user.email)?.subject).toBe(`Solicitação nº ${id2} aprovada`);
    });

    it('rejects with a reason the customer receives', async () => {
      const customer = await customerWithAddress();
      const id = (await createRequest(customer.headers)).json().id;
      const { headers } = await t.as('ADMIN');
      const short = await t.app.inject({
        method: 'POST',
        url: `/api/v1/service-requests/${id}/rejection`,
        headers,
        payload: { reason: 'não' },
      });
      expect(short.statusCode).toBe(422);
      const rejected = await t.app.inject({
        method: 'POST',
        url: `/api/v1/service-requests/${id}/rejection`,
        headers,
        payload: { reason: 'Não atendemos essa marca.' },
      });
      expect(rejected.json()).toMatchObject({
        status: 'REJECTED',
        rejectionReason: 'Não atendemos essa marca.',
        canCancel: false,
      });
      const message = await t.app.inject({
        method: 'POST',
        url: `/api/v1/service-requests/${id}/messages`,
        headers: customer.headers,
        payload: { body: 'Por quê?' },
      });
      expect(message.statusCode).toBe(409);
    });
  });

  describe('cancellation', () => {
    async function scheduled(customerHeaders: Record<string, string>, startsAt: Date) {
      const id = (await createRequest(customerHeaders)).json().id;
      const tech = await t.createUser('EMPLOYEE');
      await t.db.update(serviceRequests).set({ status: 'SCHEDULED' }).where(eq(serviceRequests.id, id));
      await t.db.insert(appointments).values({
        serviceRequestId: id,
        employeeId: tech.id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 2 * 3_600_000),
        createdById: tech.id,
      });
      return { id, tech };
    }

    it('lets the customer cancel until 18:00 of the day before, freeing the technician', async () => {
      const customer = await customerWithAddress();
      const manager = await t.createUser('MANAGER');
      const { id, tech } = await scheduled(customer.headers, new Date('2026-10-07T12:00:00Z'));
      const ok = await t.app.inject({
        method: 'POST',
        url: `/api/v1/service-requests/${id}/cancellation`,
        headers: customer.headers,
        payload: { reason: 'Consertei sozinho.' },
      });
      expect(ok.json()).toMatchObject({
        status: 'CANCELED',
        appointment: null,
        cancellationReason: 'Consertei sozinho.',
      });
      expect(await t.db.select().from(appointments)).toHaveLength(0);
      await t.deliverEmails();
      expect(t.lastEmailTo(tech.email)?.subject).toBe(`Visita cancelada: solicitação nº ${id}`);
      expect(t.lastEmailTo(manager.email)?.text).toContain('Consertei sozinho.');
    });

    it('blocks the customer after the deadline but not the management', async () => {
      const customer = await customerWithAddress();
      // Visit today at 17:00 in São Paulo: the deadline was yesterday at 18:00.
      const { id } = await scheduled(customer.headers, new Date('2026-10-05T20:00:00Z'));
      const detail = await t.app.inject({
        method: 'GET',
        url: `/api/v1/service-requests/${id}`,
        headers: customer.headers,
      });
      expect(detail.json().canCancel).toBe(false);
      const late = await t.app.inject({
        method: 'POST',
        url: `/api/v1/service-requests/${id}/cancellation`,
        headers: customer.headers,
        payload: {},
      });
      expect(late.json()).toMatchObject({ status: 409, title: 'Prazo de cancelamento encerrado' });
      const { headers } = await t.as('MANAGER');
      const byStore = await t.app.inject({
        method: 'POST',
        url: `/api/v1/service-requests/${id}/cancellation`,
        headers,
        payload: {},
      });
      expect(byStore.json().status).toBe('CANCELED');
      await t.deliverEmails();
      expect(t.lastEmailTo(customer.user.email)?.text).toContain('A loja cancelou esta solicitação.');
      expect((await t.db.select().from(auditLogs)).map((a) => a.action)).toContain('serviceRequest.cancel');
    });

    it('cancels open requests without a visit and refuses finished ones', async () => {
      const customer = await customerWithAddress();
      const id = (await createRequest(customer.headers)).json().id;
      const ok = await t.app.inject({
        method: 'POST',
        url: `/api/v1/service-requests/${id}/cancellation`,
        headers: customer.headers,
        payload: {},
      });
      expect(ok.json().status).toBe('CANCELED');
      const again = await t.app.inject({
        method: 'POST',
        url: `/api/v1/service-requests/${id}/cancellation`,
        headers: customer.headers,
        payload: {},
      });
      expect(again.statusCode).toBe(409);
      await t.deliverEmails();
      const manager = await t.createUser('MANAGER');
      const id2 = (await createRequest(customer.headers)).json().id;
      await t.app.inject({
        method: 'POST',
        url: `/api/v1/service-requests/${id2}/cancellation`,
        headers: customer.headers,
        payload: {},
      });
      await t.deliverEmails();
      expect(t.lastEmailTo(manager.email)?.text).toContain('O cliente não informou o motivo.');
    });

    it('still works when the customer or the technician were removed', async () => {
      const customer = await customerWithAddress();
      const { id, tech } = await scheduled(customer.headers, new Date('2026-10-20T12:00:00Z'));
      const { headers } = await t.as('MANAGER');
      const { anonymizeUser } = await import('../users/service.js');
      await anonymizeUser(t.db, tech.id, t.clock.now());
      await anonymizeUser(t.db, customer.user.id, t.clock.now());
      const detail = await t.app.inject({ method: 'GET', url: `/api/v1/service-requests/${id}`, headers });
      expect(detail.json().customer).toEqual({
        id: customer.user.id,
        name: 'Conta removida',
        email: '',
        phone: null,
      });
      const canceled = await t.app.inject({
        method: 'POST',
        url: `/api/v1/service-requests/${id}/cancellation`,
        headers,
        payload: { reason: 'Cliente mudou de cidade.' },
      });
      expect(canceled.json().status).toBe('CANCELED');
    });
  });
});
