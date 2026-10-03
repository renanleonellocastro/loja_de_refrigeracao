import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { auditLogs, messages, quotes, serviceRequests, serviceTypes } from '../../infra/db/schema.js';
import { jpeg } from '../../../test/images.js';
import { multipart } from '../../../test/multipart.js';
import { useTestApp } from '../../../test/harness.js';
import { anonymizeUser, saveAddress } from '../users/service.js';
import { expireQuotes } from './service.js';

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
const WINDOWS = [{ day: '2026-10-12', period: 'MORNING' }];
const DESCRIPTION = 'Quero instalar um ar condicionado split de 12000 BTUs na sala.';

type Headers = Record<string, string>;

describe('quote routes', () => {
  const t = useTestApp();

  async function serviceType(overrides: Partial<typeof serviceTypes.$inferInsert> = {}) {
    const [row] = await t.db
      .insert(serviceTypes)
      .values({ name: `Instalação ${Math.random()}`, estimatedMinutes: 120, ...overrides })
      .returning();
    return row!;
  }

  async function customer(withAddress = true) {
    const session = await t.as('CLIENT');
    if (withAddress) await saveAddress(t.db, session.user.id, ADDRESS, t.clock.now());
    return session;
  }

  async function requestQuote(headers: Headers, extra: Record<string, unknown> = {}) {
    const type = await serviceType();
    return t.app.inject({
      method: 'POST',
      url: '/api/v1/quotes',
      headers,
      payload: { serviceTypeId: type.id, description: DESCRIPTION, ...extra },
    });
  }

  const post = (url: string, headers: Headers, payload: Record<string, unknown> = {}) =>
    t.app.inject({ method: 'POST', url: `/api/v1/quotes${url}`, headers, payload });

  const get = (url: string, headers: Headers) =>
    t.app.inject({ method: 'GET', url: `/api/v1/quotes${url}`, headers });

  const answer = (id: number, headers: Headers, extra: Record<string, unknown> = {}) =>
    post(`/${id}/answer`, headers, {
      amountCents: 123456,
      validityDays: 10,
      included: 'Instalação, suporte e 3 metros de tubulação.',
      ...extra,
    });

  /** A customer with an answered quote. */
  async function answered(extra: Record<string, unknown> = {}) {
    const owner = await customer();
    const manager = await t.as('MANAGER');
    const id = (await requestQuote(owner.headers)).json().id as number;
    const response = await answer(id, manager.headers, extra);
    expect(response.statusCode).toBe(200);
    return { owner, manager, id };
  }

  /** Logs in again after the clock moved past the access token lifetime. */
  async function freshHeaders(user: { email: string }): Promise<Headers> {
    const { token } = await t.login(user);
    return { authorization: `Bearer ${token}` };
  }

  async function statusOf(id: number) {
    const [row] = await t.db.select().from(quotes).where(eq(quotes.id, id));
    return row!.status;
  }

  describe('POST /quotes', () => {
    it('creates a quote and emails the customer with the data and the managers', async () => {
      const manager = await t.createUser('MANAGER');
      const admin = await t.createUser('ADMIN');
      const { headers, user } = await customer();
      const type = await serviceType({ name: 'Instalação de ar condicionado' });
      const response = await t.app.inject({
        method: 'POST',
        url: '/api/v1/quotes',
        headers,
        payload: { serviceTypeId: type.id, description: `  ${DESCRIPTION}  ` },
      });
      expect(response.statusCode).toBe(201);
      const id = response.json().id;
      expect(response.headers.location).toBe(`/api/v1/quotes/${id}`);
      expect(response.json()).toMatchObject({
        status: 'REQUESTED',
        statusLabel: 'Solicitado',
        serviceType: { id: type.id, name: 'Instalação de ar condicionado' },
        description: DESCRIPTION,
        photos: [],
        customer: { id: user.id, email: user.email },
        amountCents: null,
        validUntil: null,
        answeredBy: null,
        serviceRequestId: null,
        canAccept: false,
        canDecline: false,
        canCancel: true,
      });
      await t.deliverEmails();
      const email = t.lastEmailTo(user.email)!;
      expect(email.subject).toBe(`Recebemos seu pedido de orçamento nº ${id}`);
      expect(email.text).toContain('Instalação de ar condicionado');
      expect(email.text).toContain('Situação: Solicitado.');
      expect(email.text).toContain(`/minha-conta/orcamentos/${id}`);
      expect(t.lastEmailTo(manager.email)?.subject).toBe(
        `Novo pedido de orçamento nº ${id}: Instalação de ar condicionado`,
      );
      expect(t.lastEmailTo(admin.email)?.text).toContain(`/orcamentos/${id}`);
      expect(await t.db.select().from(auditLogs)).toHaveLength(0);
    });

    it('validates the description and the service type', async () => {
      const { headers } = await customer();
      const short = await requestQuote(headers, { description: 'curto' });
      expect(short.json()).toMatchObject({ status: 422 });
      expect(short.json().errors[0].message).toBe('Descreva o que precisa com pelo menos 10 caracteres.');
      const long = await requestQuote(headers, { description: 'x'.repeat(2001) });
      expect(long.statusCode).toBe(422);
      const inactive = await serviceType({ active: false });
      const refused = await requestQuote(headers, { serviceTypeId: inactive.id });
      expect(refused.json()).toMatchObject({ status: 422, title: 'Serviço indisponível' });
      const missing = await requestQuote(headers, { serviceTypeId: 999999 });
      expect(missing.json().title).toBe('Serviço indisponível');
    });

    it('lets management request on behalf of a customer, with audit, but not customers for others', async () => {
      const target = await customer();
      const author = await t.as('MANAGER');
      const colleague = await t.createUser('MANAGER');
      const noCustomer = await requestQuote(author.headers);
      expect(noCustomer.json()).toMatchObject({ status: 422, title: 'Cliente obrigatório' });
      const employee = await t.createUser('EMPLOYEE');
      expect((await requestQuote(author.headers, { customerId: employee.id })).statusCode).toBe(404);
      const ok = await requestQuote(author.headers, { customerId: target.user.id });
      expect(ok.statusCode).toBe(201);
      expect(ok.json().customer.id).toBe(target.user.id);
      expect((await t.db.select().from(auditLogs)).map((a) => a.action)).toEqual(['quote.create']);
      await t.deliverEmails();
      expect(t.lastEmailTo(author.user.email)).toBeUndefined();
      expect(t.lastEmailTo(colleague.email)).toBeDefined();
      expect(t.lastEmailTo(target.user.email)?.subject).toContain('Recebemos seu pedido de orçamento');

      const other = await customer();
      expect((await requestQuote(other.headers, { customerId: target.user.id })).statusCode).toBe(403);
      expect((await requestQuote(other.headers, { customerId: other.user.id })).statusCode).toBe(201);
    });

    it('is idempotent with the same key', async () => {
      const { headers } = await customer();
      const type = await serviceType();
      const h = { ...headers, 'idempotency-key': 'orcamento-123' };
      const payload = { serviceTypeId: type.id, description: DESCRIPTION };
      const first = await t.app.inject({ method: 'POST', url: '/api/v1/quotes', headers: h, payload });
      const again = await t.app.inject({ method: 'POST', url: '/api/v1/quotes', headers: h, payload });
      expect(again.headers['idempotent-replayed']).toBe('true');
      expect(again.statusCode).toBe(201);
      expect(again.json()).toEqual(first.json());
      expect(await t.db.select().from(quotes)).toHaveLength(1);
    });
  });

  describe('visibility and listing', () => {
    it('shows customers only their own quotes and management all of them, with filters', async () => {
      const ana = await customer();
      const bia = await customer();
      const a = (await requestQuote(ana.headers)).json().id;
      const b = (await requestQuote(bia.headers)).json().id;
      const manager = await t.as('MANAGER');
      await answer(b, manager.headers);

      const anaList = await get('?q=ignorado', ana.headers);
      expect(anaList.json().data.map((q: { id: number }) => q.id)).toEqual([a]);
      expect(anaList.json().data[0]).toMatchObject({
        status: 'REQUESTED',
        statusLabel: 'Solicitado',
        customer: { id: ana.user.id, name: ana.user.name },
        amountCents: null,
      });
      for (const response of [
        await get(`/${b}`, ana.headers),
        await get(`/${b}/messages`, ana.headers),
        await post(`/${b}/messages`, ana.headers, { body: 'Oi' }),
        await post(`/${b}/acceptance`, ana.headers, { windows: WINDOWS }),
        await post(`/${b}/decline`, ana.headers),
        await post(`/${b}/cancellation`, ana.headers),
      ]) {
        expect(response.statusCode).toBe(404);
      }

      const all = await get('', manager.headers);
      expect(all.json().meta.total).toBe(2);
      const answeredOnly = await get('?status=ANSWERED,EXPIRED', manager.headers);
      expect(answeredOnly.json().data).toMatchObject([
        { id: b, status: 'ANSWERED', amountCents: 123456, validUntil: '2026-10-15' },
      ]);
      const byName = await get(`?q=${encodeURIComponent(ana.user.name)}`, manager.headers);
      expect(byName.json().data.map((q: { id: number }) => q.id)).toEqual([a]);
      const byNumber = await get(`?q=${b}`, manager.headers);
      expect(byNumber.json().data.map((q: { id: number }) => q.id)).toEqual([b]);
      const paged = await get('?pageSize=1&page=2', manager.headers);
      expect(paged.json()).toMatchObject({ meta: { page: 2, pageSize: 1, total: 2 } });
      expect((await get('/999999', manager.headers)).statusCode).toBe(404);
    });

    it('shows a removed customer without personal data and skips their emails', async () => {
      const owner = await customer();
      const id = (await requestQuote(owner.headers)).json().id;
      await anonymizeUser(t.db, owner.user.id, t.clock.now());
      const manager = await t.as('MANAGER');
      const detail = await get(`/${id}`, manager.headers);
      expect(detail.json().customer).toEqual({
        id: owner.user.id,
        name: 'Conta removida',
        email: '',
        phone: null,
      });
      await t.deliverEmails();
      t.mailer.sent.length = 0;
      await post(`/${id}/cancellation`, manager.headers);
      await t.deliverEmails();
      expect(t.mailer.sent).toHaveLength(0);
    });
  });

  describe('photos', () => {
    it('accepts up to 6 photos from the owner while requested and from management while open', async () => {
      const owner = await customer();
      const id = (await requestQuote(owner.headers)).json().id;
      const manager = await t.as('MANAGER');
      const photo = await jpeg(800, 600);
      const upload = (count: number, headers: Headers) => {
        const body = multipart(
          Array.from({ length: count }, (_, i) => ({ name: 'fotos', value: photo, filename: `${i}.jpg` })),
        );
        return t.app.inject({
          method: 'POST',
          url: `/api/v1/quotes/${id}/photos`,
          payload: body.payload,
          headers: { ...headers, ...body.headers },
        });
      };
      const first = await upload(4, owner.headers);
      expect(first.statusCode).toBe(201);
      expect(first.json()).toHaveLength(4);
      expect((await upload(3, owner.headers)).json()).toMatchObject({ status: 422, title: 'Fotos demais' });

      await answer(id, manager.headers);
      expect((await upload(1, owner.headers)).json()).toMatchObject({
        status: 409,
        title: 'Não é possível enviar fotos',
      });
      expect((await upload(1, manager.headers)).statusCode).toBe(201);
      expect((await get(`/${id}`, owner.headers)).json().photos).toHaveLength(5);

      await post(`/${id}/cancellation`, manager.headers);
      expect((await upload(1, manager.headers)).statusCode).toBe(409);
      const stranger = await customer();
      expect((await upload(1, stranger.headers)).statusCode).toBe(404);
    });
  });

  describe('conversation', () => {
    it('lets the store and the customer talk while the quote is open', async () => {
      const owner = await customer();
      const id = (await requestQuote(owner.headers)).json().id;
      const { headers, user: manager } = await t.as('MANAGER');
      const ask = await post(`/${id}/messages`, headers, { body: 'Qual a distância até a condensadora?' });
      expect(ask.statusCode).toBe(201);
      expect(ask.json()[0]).toMatchObject({ mine: true, author: { id: manager.id, role: 'MANAGER' } });
      expect((await get(`/${id}`, headers)).json().status).toBe('REQUESTED');
      await t.deliverEmails();
      expect(t.lastEmailTo(owner.user.email)).toMatchObject({
        subject: `Mensagem sobre seu orçamento nº ${id}`,
      });
      expect(t.lastEmailTo(owner.user.email)?.text).toContain('Qual a distância até a condensadora?');

      const reply = await post(`/${id}/messages`, owner.headers, { body: 'Uns 4 metros.' });
      expect(reply.json().map((m: { mine: boolean }) => m.mine)).toEqual([false, true]);
      await t.deliverEmails();
      expect(t.lastEmailTo(manager.email)?.subject).toBe(`Mensagem do cliente no orçamento nº ${id}`);
      expect((await get(`/${id}/messages`, owner.headers)).json()).toHaveLength(2);
      expect((await post(`/${id}/messages`, owner.headers, { body: '' })).statusCode).toBe(422);

      await post(`/${id}/cancellation`, owner.headers);
      const late = await post(`/${id}/messages`, owner.headers, { body: 'Ainda dá?' });
      expect(late.json()).toMatchObject({ status: 409, title: 'Ação indisponível' });
      expect(late.json().detail).toBe('Não é possível fazer isso com um orçamento cancelado.');
    });
  });

  describe('POST /quotes/{id}/answer', () => {
    it('answers with value and validity, emails the customer and audits', async () => {
      const owner = await customer();
      const id = (await requestQuote(owner.headers)).json().id;
      const { headers, user: manager } = await t.as('MANAGER');
      const response = await answer(id, headers, { notes: 'Pagamento na conclusão.' });
      expect(response.json()).toMatchObject({
        status: 'ANSWERED',
        statusLabel: 'Respondido',
        amountCents: 123456,
        validUntil: '2026-10-15',
        included: 'Instalação, suporte e 3 metros de tubulação.',
        notes: 'Pagamento na conclusão.',
        answeredBy: { id: manager.id, name: manager.name },
        canAccept: false,
        canDecline: false,
        canCancel: true,
      });
      expect(response.json().answeredAt).toBe(t.clock.now().toISOString());
      const forOwner = (await get(`/${id}`, owner.headers)).json();
      expect(forOwner).toMatchObject({ canAccept: true, canDecline: true, canCancel: false });

      await t.deliverEmails();
      const email = t.lastEmailTo(owner.user.email)!;
      expect(email.subject).toBe(`Seu orçamento nº ${id} está pronto`);
      expect(email.text).toContain('Valor: R$ 1.234,56.');
      expect(email.text).toContain('Válido até 15/10/2026.');
      expect(email.text).toContain('Observações: Pagamento na conclusão.');
      expect(email.text).toContain(`http://localhost:3000/minha-conta/orcamentos/${id}`);
      const [audit] = await t.db.select().from(auditLogs);
      expect(audit).toMatchObject({ action: 'quote.answer', resourceType: 'quote', actorId: manager.id });

      const again = await answer(id, headers);
      expect(again.json()).toMatchObject({ status: 409, title: 'Ação indisponível' });
    });

    it('validates the value and the validity', async () => {
      const owner = await customer();
      const id = (await requestQuote(owner.headers)).json().id;
      const { headers } = await t.as('ADMIN');
      const zero = await answer(id, headers, { amountCents: 0 });
      expect(zero.json().errors).toEqual([
        { path: 'amountCents', message: 'O valor precisa ser maior que zero.' },
      ]);
      const tooLong = await answer(id, headers, { validityDays: 91 });
      expect(tooLong.json().errors[0].message).toBe('A validade máxima é de 90 dias.');
      expect((await answer(id, headers, { validityDays: 0 })).statusCode).toBe(422);
      expect((await answer(id, headers, { amountCents: 10.5 })).statusCode).toBe(422);
      expect((await answer(id, headers, { included: '' })).statusCode).toBe(422);
      const ok = await answer(id, headers, { notes: '', validityDays: 90 });
      expect(ok.json()).toMatchObject({ notes: null, validUntil: '2027-01-03' });
      await t.deliverEmails();
      expect(t.lastEmailTo(owner.user.email)?.text).not.toContain('Observações');
    });

    it('counts validity days from today in São Paulo', async () => {
      // 23:30 of 05/10 in São Paulo is already 06/10 in UTC.
      t.clock.set(new Date('2026-10-06T02:30:00Z'));
      const owner = await customer();
      const id = (await requestQuote(owner.headers)).json().id;
      const { headers } = await t.as('MANAGER');
      expect((await answer(id, headers, { validityDays: 1 })).json().validUntil).toBe('2026-10-06');
    });
  });

  describe('POST /quotes/{id}/acceptance', () => {
    it('accepts and creates a linked service request in the same step', async () => {
      const { owner, id } = await answered();
      const manager = await t.createUser('MANAGER');
      const response = await post(`/${id}/acceptance`, owner.headers, { windows: WINDOWS });
      expect(response.statusCode).toBe(200);
      const { quote, serviceRequestId } = response.json();
      expect(quote).toMatchObject({
        status: 'ACCEPTED',
        statusLabel: 'Aceito',
        serviceRequestId,
        canAccept: false,
        canDecline: false,
        canCancel: false,
      });
      expect(quote.decidedAt).toBe(t.clock.now().toISOString());
      const [request] = await t.db.select().from(serviceRequests);
      const [row] = await t.db.select().from(quotes).where(eq(quotes.id, id));
      const [type] = await t.db.select().from(serviceTypes).where(eq(serviceTypes.id, row!.serviceTypeId));
      expect(request).toMatchObject({
        id: serviceRequestId,
        quoteId: id,
        customerId: owner.user.id,
        status: 'REQUESTED',
        problem: DESCRIPTION,
        productKind: type!.name,
        address: ADDRESS,
      });
      await t.deliverEmails();
      const notices = t.mailer.sent.filter((m) => m.to === manager.email).map((m) => m.subject);
      expect(notices).toContain(`Orçamento nº ${id} aceito`);
      expect(t.lastEmailTo(manager.email)?.text).toBeDefined();
      expect(t.mailer.sent.find((m) => m.subject === `Orçamento nº ${id} aceito`)?.text).toContain(
        'R$ 1.234,56',
      );
      expect(t.lastEmailTo(owner.user.email)?.subject).toBe(
        `Recebemos sua solicitação nº ${serviceRequestId}`,
      );

      const again = await post(`/${id}/acceptance`, owner.headers, { windows: WINDOWS });
      expect(again.json()).toMatchObject({ status: 409, title: 'Ação indisponível' });
      expect(await t.db.select().from(serviceRequests)).toHaveLength(1);
    });

    it('takes the product, brand, model and an explicit address', async () => {
      const { owner, id } = await answered();
      const response = await post(`/${id}/acceptance`, owner.headers, {
        windows: WINDOWS,
        productKind: 'Ar condicionado split',
        brand: 'LG',
        model: 'Dual Inverter',
        address: { ...ADDRESS, number: '100' },
      });
      const [request] = await t.db
        .select()
        .from(serviceRequests)
        .where(eq(serviceRequests.id, response.json().serviceRequestId));
      expect(request).toMatchObject({
        productKind: 'Ar condicionado split',
        brand: 'LG',
        model: 'Dual Inverter',
        address: { ...ADDRESS, number: '100' },
      });
    });

    it('changes nothing when the service request cannot be created', async () => {
      const owner = await customer(false);
      const manager = await t.as('MANAGER');
      const id = (await requestQuote(owner.headers)).json().id;
      await answer(id, manager.headers);

      const noAddress = await post(`/${id}/acceptance`, owner.headers, { windows: WINDOWS });
      expect(noAddress.json()).toMatchObject({ status: 422, title: 'Endereço obrigatório' });
      const today = await post(`/${id}/acceptance`, owner.headers, {
        windows: [{ day: '2026-10-05', period: 'MORNING' }],
        address: ADDRESS,
      });
      expect(today.json().errors[0]).toEqual({
        path: 'windows.0.day',
        message: 'Escolha datas a partir de amanhã.',
      });
      const [row] = await t.db.select().from(quotes).where(eq(quotes.id, id));
      await t.db.update(serviceTypes).set({ active: false }).where(eq(serviceTypes.id, row!.serviceTypeId));
      const inactive = await post(`/${id}/acceptance`, owner.headers, { windows: WINDOWS, address: ADDRESS });
      expect(inactive.json()).toMatchObject({ status: 422, title: 'Serviço indisponível' });
      expect((await post(`/${id}/acceptance`, owner.headers, { windows: [] })).statusCode).toBe(422);

      expect(await statusOf(id)).toBe('ANSWERED');
      expect(await t.db.select().from(serviceRequests)).toHaveLength(0);
      expect((await get(`/${id}`, owner.headers)).json()).toMatchObject({ decidedAt: null, canAccept: true });
    });

    it('accepts until the last valid day in São Paulo and refuses afterwards', async () => {
      const { owner, id } = await answered({ validityDays: 1 });
      const second = await requestQuote(owner.headers);
      const manager = await t.as('MANAGER');
      await answer(second.json().id, manager.headers, { validityDays: 1 });

      // 23:59 of 06/10 in São Paulo: still valid.
      t.clock.set(new Date('2026-10-07T02:59:00Z'));
      let headers = await freshHeaders(owner.user);
      expect((await post(`/${id}/acceptance`, headers, { windows: WINDOWS })).statusCode).toBe(200);
      // 00:00 of 07/10 in São Paulo: expired, even before the scheduled task runs.
      t.clock.set(new Date('2026-10-07T03:00:00Z'));
      headers = await freshHeaders(owner.user);
      const late = await post(`/${second.json().id}/acceptance`, headers, { windows: WINDOWS });
      expect(late.json()).toMatchObject({
        status: 409,
        title: 'Orçamento vencido',
        detail: 'Este orçamento valia até 06/10/2026. Peça um novo orçamento.',
      });
      expect((await get(`/${second.json().id}`, headers)).json()).toMatchObject({
        status: 'ANSWERED',
        canAccept: false,
        canDecline: true,
      });
    });

    it('refuses quotes that were not answered', async () => {
      const owner = await customer();
      const id = (await requestQuote(owner.headers)).json().id;
      const response = await post(`/${id}/acceptance`, owner.headers, { windows: WINDOWS });
      expect(response.json()).toMatchObject({
        status: 409,
        detail: 'Não é possível fazer isso com um orçamento solicitado.',
      });
    });
  });

  describe('POST /quotes/{id}/decline', () => {
    it('declines with a reason and tells the management', async () => {
      const { owner, manager, id } = await answered();
      const response = await post(`/${id}/decline`, owner.headers, { reason: 'Achei caro.' });
      expect(response.json()).toMatchObject({
        status: 'DECLINED',
        statusLabel: 'Recusado',
        declineReason: 'Achei caro.',
        canAccept: false,
        canDecline: false,
      });
      expect(response.json().decidedAt).toBe(t.clock.now().toISOString());
      await t.deliverEmails();
      expect(t.lastEmailTo(manager.user.email)).toMatchObject({ subject: `Orçamento nº ${id} recusado` });
      expect(t.lastEmailTo(manager.user.email)?.text).toContain('Achei caro.');
      expect((await post(`/${id}/decline`, owner.headers)).statusCode).toBe(409);
    });

    it('declines without a reason', async () => {
      const { owner, manager, id } = await answered();
      const response = await post(`/${id}/decline`, owner.headers, { reason: '' });
      expect(response.json()).toMatchObject({ status: 'DECLINED', declineReason: null });
      await t.deliverEmails();
      expect(t.lastEmailTo(manager.user.email)?.text).toContain('O cliente não informou o motivo.');
    });
  });

  describe('POST /quotes/{id}/cancellation', () => {
    it('lets the customer cancel only while the quote waits for an answer', async () => {
      const owner = await customer();
      const manager = await t.createUser('MANAGER');
      const id = (await requestQuote(owner.headers)).json().id;
      const canceled = await post(`/${id}/cancellation`, owner.headers, { reason: 'Já resolvi.' });
      expect(canceled.json()).toMatchObject({
        status: 'CANCELED',
        statusLabel: 'Cancelado',
        canCancel: false,
      });
      expect((await get(`/${id}/messages`, owner.headers)).json()[0]).toMatchObject({ body: 'Já resolvi.' });
      await t.deliverEmails();
      expect(t.lastEmailTo(manager.email)).toMatchObject({
        subject: `Orçamento nº ${id} cancelado pelo cliente`,
      });
      expect(t.lastEmailTo(manager.email)?.text).toContain('Já resolvi.');

      const id2 = (await requestQuote(owner.headers)).json().id;
      await post(`/${id2}/cancellation`, owner.headers);
      await t.deliverEmails();
      expect(t.lastEmailTo(manager.email)?.text).toContain('O cliente não informou o motivo.');

      const { owner: other, id: answeredId } = await answered();
      expect((await post(`/${answeredId}/cancellation`, other.headers)).statusCode).toBe(409);
    });

    it('lets management cancel open quotes, telling the customer, with audit', async () => {
      const { owner, manager, id } = await answered();
      const canceled = await post(`/${id}/cancellation`, manager.headers, { reason: 'Peça fora de linha.' });
      expect(canceled.json().status).toBe('CANCELED');
      await t.deliverEmails();
      expect(t.lastEmailTo(owner.user.email)).toMatchObject({ subject: `Orçamento nº ${id} cancelado` });
      expect(t.lastEmailTo(owner.user.email)?.text).toContain('Peça fora de linha.');
      expect((await t.db.select().from(auditLogs)).map((a) => a.action)).toContain('quote.cancel');
      expect((await post(`/${id}/cancellation`, manager.headers)).statusCode).toBe(409);

      const id2 = (await requestQuote(owner.headers)).json().id;
      await post(`/${id2}/cancellation`, manager.headers);
      await t.deliverEmails();
      expect(t.lastEmailTo(owner.user.email)?.text).toContain('A loja cancelou este orçamento.');
      expect(await t.db.select().from(messages).where(eq(messages.threadId, id2))).toHaveLength(0);
    });
  });

  describe('expiration', () => {
    it('expires answered quotes after their last valid day in São Paulo and tells everyone', async () => {
      const { owner, manager, id } = await answered({ validityDays: 1 });
      const later = await answered({ validityDays: 2 });
      const waiting = (await requestQuote(owner.headers)).json().id;
      const removed = await answered({ validityDays: 1 });
      await anonymizeUser(t.db, removed.owner.user.id, t.clock.now());
      await t.deliverEmails();
      t.mailer.sent.length = 0;

      // 23:59 of 06/10 in São Paulo: the last valid day of the first quote is not over yet.
      t.clock.set(new Date('2026-10-07T02:59:00Z'));
      expect(await expireQuotes(t.ctx)).toBe(0);

      // 00:00 of 07/10 in São Paulo.
      t.clock.set(new Date('2026-10-07T03:00:00Z'));
      expect(await expireQuotes(t.ctx)).toBe(2);
      expect(await statusOf(id)).toBe('EXPIRED');
      expect(await statusOf(removed.id)).toBe('EXPIRED');
      expect(await statusOf(later.id)).toBe('ANSWERED');
      expect(await statusOf(waiting)).toBe('REQUESTED');
      const headers = await freshHeaders(owner.user);
      const detail = (await get(`/${id}`, headers)).json();
      expect(detail).toMatchObject({ status: 'EXPIRED', statusLabel: 'Vencido', canAccept: false });

      await t.deliverEmails();
      const customerEmail = t.lastEmailTo(owner.user.email)!;
      expect(customerEmail.subject).toBe(`Seu orçamento nº ${id} venceu`);
      expect(customerEmail.text).toContain('terminou em 06/10/2026');
      const staffSubjects = t.mailer.sent.filter((m) => m.to === manager.user.email).map((m) => m.subject);
      expect(staffSubjects).toEqual(
        expect.arrayContaining([`Orçamento nº ${id} venceu`, `Orçamento nº ${removed.id} venceu`]),
      );
      expect(t.mailer.sent.some((m) => m.to.startsWith('removido-'))).toBe(false);

      expect(await expireQuotes(t.ctx)).toBe(0);
      const late = await post(`/${id}/acceptance`, headers, { windows: WINDOWS });
      expect(late.json().detail).toBe('Não é possível fazer isso com um orçamento vencido.');
    });
  });
});
