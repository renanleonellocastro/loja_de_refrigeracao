import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { appointments, auditLogs, serviceRequests, serviceTypes } from '../../infra/db/schema.js';
import { jpeg } from '../../../test/images.js';
import { multipart } from '../../../test/multipart.js';
import { useTestApp } from '../../../test/harness.js';
import { mapOverlapViolation as mapOverlapViolationForTest } from './agenda.js';

const ADDRESS = {
  cep: '13800061',
  street: 'Rua Doutor Ulhoa Cintra',
  number: '91',
  complement: null,
  district: 'Centro',
  city: 'Mogi Mirim',
  state: 'SP',
};

// START is 2026-10-05 12:00 UTC. Visits on 2026-10-07 at 12:00 UTC are 09:00 in São Paulo.
const AT = (hour: number) => new Date(`2026-10-07T${String(hour).padStart(2, '0')}:00:00.000Z`);

describe('agenda routes', () => {
  const t = useTestApp();

  async function approvedRequest(status: 'APPROVED' | 'REQUESTED' = 'APPROVED') {
    const customer = await t.createUser('CLIENT');
    const [type] = await t.db
      .insert(serviceTypes)
      .values({ name: `Conserto ${Math.random()}`, estimatedMinutes: 120 })
      .returning();
    const [request] = await t.db
      .insert(serviceRequests)
      .values({
        customerId: customer.id,
        serviceTypeId: type!.id,
        productKind: 'Geladeira',
        problem: 'Não gela.',
        address: ADDRESS,
        status,
        createdById: customer.id,
      })
      .returning();
    return { request: request!, customer, type: type! };
  }

  async function schedule(
    headers: Record<string, string>,
    employeeId: number,
    startsAt = AT(12),
    endsAt?: Date,
  ) {
    const { request, customer } = await approvedRequest();
    const response = await t.app.inject({
      method: 'POST',
      url: '/api/v1/appointments',
      headers,
      payload: {
        serviceRequestId: request.id,
        employeeId,
        startsAt: startsAt.toISOString(),
        ...(endsAt ? { endsAt: endsAt.toISOString() } : {}),
      },
    });
    return { response, request, customer };
  }

  describe('scheduling', () => {
    it('puts the approved request on the technician agenda with the estimated duration', async () => {
      const tech = await t.createUser('EMPLOYEE');
      const { headers } = await t.as('MANAGER');
      const { response, request, customer } = await schedule(headers, tech.id);
      expect(response.statusCode).toBe(201);
      expect(response.headers.etag).toBe('W/"1"');
      expect(response.json()).toMatchObject({
        startsAt: AT(12).toISOString(),
        endsAt: AT(14).toISOString(),
        employee: { id: tech.id },
        request: {
          id: request.id,
          status: 'SCHEDULED',
          statusLabel: 'Agendado',
          customer: { id: customer.id },
        },
        report: null,
      });
      await t.deliverEmails();
      expect(t.lastEmailTo(customer.email)?.text).toContain('quarta-feira, 07/10, 09:00 (09:00 às 11:00)');
      expect(t.lastEmailTo(tech.email)?.subject).toBe('Novo atendimento na sua agenda');
      expect((await t.db.select().from(auditLogs))[0]!.action).toBe('appointment.create');
    });

    it('refuses overlaps, past times, long visits, non technicians and requests not approved', async () => {
      const tech = await t.createUser('EMPLOYEE');
      const { headers } = await t.as('MANAGER');
      await schedule(headers, tech.id, AT(12), AT(14));
      const overlap = await schedule(headers, tech.id, AT(13), AT(15));
      expect(overlap.response.json()).toMatchObject({
        status: 409,
        title: 'Horário ocupado',
        conflictingAppointmentId: expect.any(Number),
      });
      expect(overlap.response.json().detail).toContain('09:00 às 11:00');
      const adjacent = await schedule(headers, tech.id, AT(14), AT(15));
      expect(adjacent.response.statusCode).toBe(201);

      const past = await schedule(headers, tech.id, new Date('2026-10-04T12:00:00Z'));
      expect(past.response.json().errors).toEqual([
        { path: 'startsAt', message: 'Escolha um horário futuro.' },
      ]);
      const backwards = await schedule(headers, tech.id, AT(18), AT(17));
      expect(backwards.response.json().errors[0].path).toBe('endsAt');
      const tooLong = await schedule(headers, tech.id, AT(1), new Date('2026-10-08T02:00:00Z'));
      expect(tooLong.response.json().detail).toBe('Um atendimento dura no máximo 12 horas.');

      const manager = await t.createUser('MANAGER');
      expect((await schedule(headers, manager.id, AT(20))).response.json().title).toBe(
        'Colaborador inválido',
      );

      const { request } = await approvedRequest('REQUESTED');
      const notApproved = await t.app.inject({
        method: 'POST',
        url: '/api/v1/appointments',
        headers,
        payload: { serviceRequestId: request.id, employeeId: tech.id, startsAt: AT(20).toISOString() },
      });
      expect(notApproved.json()).toMatchObject({ status: 409, title: 'Ação indisponível' });
      const missing = await t.app.inject({
        method: 'POST',
        url: '/api/v1/appointments',
        headers,
        payload: { serviceRequestId: 999999, employeeId: tech.id, startsAt: AT(20).toISOString() },
      });
      expect(missing.statusCode).toBe(404);
    });

    it('maps the database overlap constraint to 409 and rethrows other errors', () => {
      expect(() => mapOverlapViolationForTest({ cause: { code: '23P01' } })).toThrowError(
        expect.objectContaining({ status: 409 }),
      );
      expect(() => mapOverlapViolationForTest({ code: '23P01' })).toThrowError(
        expect.objectContaining({ status: 409 }),
      );
      expect(() => mapOverlapViolationForTest(new Error('other'))).toThrowError('other');
    });
  });

  describe('reading the agenda', () => {
    it('shows each technician only their own visits and management everyone', async () => {
      const ana = await t.as('EMPLOYEE');
      const bruno = await t.as('EMPLOYEE');
      const { headers } = await t.as('MANAGER');
      const a = (await schedule(headers, ana.user.id)).response.json();
      await schedule(headers, bruno.user.id);
      const range = 'from=2026-10-06T00:00:00Z&to=2026-10-09T00:00:00Z';
      const own = await t.app.inject({
        method: 'GET',
        url: `/api/v1/appointments?${range}&employeeId=${bruno.user.id}`,
        headers: ana.headers,
      });
      expect(own.json().map((x: { id: number }) => x.id)).toEqual([a.id]);
      const all = await t.app.inject({ method: 'GET', url: `/api/v1/appointments?${range}`, headers });
      expect(all.json()).toHaveLength(2);
      const filtered = await t.app.inject({
        method: 'GET',
        url: `/api/v1/appointments?${range}&employeeId=${ana.user.id}`,
        headers,
      });
      expect(filtered.json()).toHaveLength(1);
      const other = await t.app.inject({
        method: 'GET',
        url: `/api/v1/appointments/${a.id}`,
        headers: bruno.headers,
      });
      expect(other.statusCode).toBe(404);
      const mine = await t.app.inject({
        method: 'GET',
        url: `/api/v1/appointments/${a.id}`,
        headers: ana.headers,
      });
      expect(mine.headers.etag).toBe('W/"1"');
    });

    it('validates the range', async () => {
      const { headers } = await t.as('MANAGER');
      const reversed = await t.app.inject({
        method: 'GET',
        url: '/api/v1/appointments?from=2026-10-09&to=2026-10-01',
        headers,
      });
      expect(reversed.json().errors[0]).toMatchObject({
        path: 'to',
        message: 'A data final deve ser depois da inicial.',
      });
      const long = await t.app.inject({
        method: 'GET',
        url: '/api/v1/appointments?from=2026-01-01&to=2026-12-01',
        headers,
      });
      expect(long.json().errors[0].message).toBe('Consulte no máximo 62 dias por vez.');
      // Found by Schemathesis: an empty date used to reach the range checks and answer 500.
      const empty = await t.app.inject({
        method: 'GET',
        url: '/api/v1/appointments?from=2000-01-01T00:00:00Z&to=',
        headers,
      });
      expect(empty.statusCode).toBe(422);
      expect(empty.json().errors).toEqual([{ path: 'to', message: 'Data final inválida.' }]);
    });

    it('lists busy intervals per technician', async () => {
      const tech = await t.createUser('EMPLOYEE', { name: 'Ana Técnica' });
      await t.createUser('EMPLOYEE', { name: 'Bruno Técnico' });
      const { headers } = await t.as('MANAGER');
      await schedule(headers, tech.id);
      const response = await t.app.inject({
        method: 'GET',
        url: '/api/v1/employees/availability?from=2026-10-07T00:00:00Z&to=2026-10-08T00:00:00Z',
        headers,
      });
      expect(
        response
          .json()
          .map((e: { employee: { name: string }; busy: unknown[] }) => [e.employee.name, e.busy.length]),
      ).toEqual([
        ['Ana Técnica', 1],
        ['Bruno Técnico', 0],
      ]);
    });

    it('answers availability with no technicians', async () => {
      const { headers } = await t.as('MANAGER');
      const response = await t.app.inject({
        method: 'GET',
        url: '/api/v1/employees/availability?from=2026-10-07T00:00:00Z&to=2026-10-08T00:00:00Z',
        headers,
      });
      expect(response.json()).toEqual([]);
    });
  });

  describe('rescheduling and removal', () => {
    it('moves the visit with If-Match, keeps the duration and notifies everyone', async () => {
      const ana = await t.createUser('EMPLOYEE');
      const bruno = await t.createUser('EMPLOYEE');
      const { headers } = await t.as('MANAGER');
      const { response, customer } = await schedule(headers, ana.id);
      const id = response.json().id;
      const patch = (payload: object, ifMatch?: string) =>
        t.app.inject({
          method: 'PATCH',
          url: `/api/v1/appointments/${id}`,
          headers: ifMatch ? { ...headers, 'if-match': ifMatch } : headers,
          payload,
        });
      expect((await patch({ startsAt: AT(16).toISOString() })).statusCode).toBe(428);
      const moved = await patch({ startsAt: AT(16).toISOString(), employeeId: bruno.id }, 'W/"1"');
      expect(moved.json()).toMatchObject({
        endsAt: AT(18).toISOString(),
        version: 2,
        employee: { id: bruno.id },
      });
      expect(moved.headers.etag).toBe('W/"2"');
      expect((await patch({ startsAt: AT(17).toISOString() }, 'W/"1"')).statusCode).toBe(412);
      const longer = await patch({ endsAt: AT(19).toISOString() }, 'W/"2"');
      expect(longer.json()).toMatchObject({ startsAt: AT(16).toISOString(), endsAt: AT(19).toISOString() });
      const nothing = await patch({}, 'W/"3"');
      expect(nothing.json().version).toBe(4);
      await t.deliverEmails();
      expect(t.lastEmailTo(customer.email)?.subject).toContain('Visita remarcada');
      expect(t.lastEmailTo(ana.email)?.subject).toBe('Atendimento saiu da sua agenda');
      expect(t.lastEmailTo(bruno.email)?.subject).toBe('Atendimento atualizado na sua agenda');
    });

    it('refuses moving onto a busy slot', async () => {
      const tech = await t.createUser('EMPLOYEE');
      const { headers } = await t.as('MANAGER');
      await schedule(headers, tech.id, AT(12));
      const second = (await schedule(headers, tech.id, AT(16))).response.json();
      const response = await t.app.inject({
        method: 'PATCH',
        url: `/api/v1/appointments/${second.id}`,
        headers: { ...headers, 'if-match': 'W/"1"' },
        payload: { startsAt: AT(13).toISOString() },
      });
      expect(response.statusCode).toBe(409);
    });

    it('lets only the super user remove a visit, sending the request back to approved', async () => {
      const tech = await t.createUser('EMPLOYEE');
      const manager = await t.as('MANAGER');
      const { response, request, customer } = await schedule(manager.headers, tech.id);
      const id = response.json().id;
      expect(
        (
          await t.app.inject({
            method: 'DELETE',
            url: `/api/v1/appointments/${id}`,
            headers: manager.headers,
          })
        ).statusCode,
      ).toBe(403);
      const admin = await t.as('ADMIN');
      expect(
        (await t.app.inject({ method: 'DELETE', url: `/api/v1/appointments/${id}`, headers: admin.headers }))
          .statusCode,
      ).toBe(204);
      const [row] = await t.db.select().from(serviceRequests).where(eq(serviceRequests.id, request.id));
      expect(row!.status).toBe('APPROVED');
      await t.deliverEmails();
      expect(t.lastEmailTo(customer.email)?.subject).toContain('Visita desmarcada');
      expect(
        (await t.app.inject({ method: 'DELETE', url: `/api/v1/appointments/${id}`, headers: admin.headers }))
          .statusCode,
      ).toBe(404);
    });
  });

  describe('finishing and approving', () => {
    async function scheduledFor(tech: { id: number }) {
      const { headers } = await t.as('MANAGER');
      const { response, customer, request } = await schedule(headers, tech.id);
      return { id: response.json().id as number, customer, request, managerHeaders: headers };
    }

    it('takes the report from the technician, then the approval with the value', async () => {
      const tech = await t.as('EMPLOYEE');
      const { id, customer, managerHeaders } = await scheduledFor(tech.user);
      const noDescription = await t.app.inject({
        method: 'POST',
        url: `/api/v1/appointments/${id}/report`,
        headers: tech.headers,
        payload: { defectFound: true, repairDescription: 'Troca do termostato.' },
      });
      expect(noDescription.json().errors).toEqual([
        { path: 'defectDescription', message: 'Descreva o defeito encontrado.' },
      ]);

      const photosFirst = await t.app.inject({
        method: 'POST',
        url: `/api/v1/appointments/${id}/report/photos`,
        ...withHeaders(
          multipart([{ name: 'f', value: await jpeg(400, 300), filename: 'a.jpg' }]),
          tech.headers,
        ),
      });
      expect(photosFirst.statusCode).toBe(409);

      const report = await t.app.inject({
        method: 'POST',
        url: `/api/v1/appointments/${id}/report`,
        headers: tech.headers,
        payload: {
          defectFound: true,
          defectDescription: 'Termostato queimado.',
          repairDescription: 'Troca do termostato.',
        },
      });
      expect(report.json()).toMatchObject({
        request: { status: 'AWAITING_COMPLETION_APPROVAL' },
        report: { status: 'SUBMITTED' },
      });

      const photos = await t.app.inject({
        method: 'POST',
        url: `/api/v1/appointments/${id}/report/photos`,
        ...withHeaders(
          multipart([{ name: 'f', value: await jpeg(400, 300), filename: 'a.jpg' }]),
          tech.headers,
        ),
      });
      expect(photos.json().report.photos).toHaveLength(1);
      const tooMany = await t.app.inject({
        method: 'POST',
        url: `/api/v1/appointments/${id}/report/photos`,
        ...withHeaders(
          multipart(
            Array.from({ length: 8 }, (_, i) => ({
              name: 'f',
              value: Buffer.from([i]),
              filename: `${i}.jpg`,
            })),
          ),
          tech.headers,
        ),
      });
      expect(tooMany.json().title).toBe('Fotos demais');

      const approved = await t.app.inject({
        method: 'POST',
        url: `/api/v1/appointments/${id}/report/approval`,
        headers: managerHeaders,
        payload: { amountCents: 25000 },
      });
      expect(approved.json()).toMatchObject({
        request: { status: 'COMPLETED' },
        report: { status: 'APPROVED', amountCents: 25000 },
      });
      await t.deliverEmails();
      const email = t.lastEmailTo(customer.email)!;
      expect(email.text).toContain('Valor do serviço: R$ 250,00.');
      expect(email.text).toContain('Defeito encontrado: Termostato queimado.');
      const afterApproval = await t.app.inject({
        method: 'POST',
        url: `/api/v1/appointments/${id}/report/photos`,
        ...withHeaders(
          multipart([{ name: 'f', value: await jpeg(10, 10), filename: 'a.jpg' }]),
          tech.headers,
        ),
      });
      expect(afterApproval.statusCode).toBe(409);
    });

    it('sends the report back for rework and accepts it again', async () => {
      const tech = await t.as('EMPLOYEE');
      const { id, managerHeaders, customer } = await scheduledFor(tech.user);
      const submit = () =>
        t.app.inject({
          method: 'POST',
          url: `/api/v1/appointments/${id}/report`,
          headers: tech.headers,
          payload: { defectFound: false, repairDescription: 'Limpeza do condensador.' },
        });
      await submit();
      const rework = await t.app.inject({
        method: 'POST',
        url: `/api/v1/appointments/${id}/report/rework`,
        headers: managerHeaders,
        payload: { comment: 'Faltou a foto do condensador.' },
      });
      expect(rework.json()).toMatchObject({
        request: { status: 'SCHEDULED' },
        report: { status: 'REWORK', reworkComment: 'Faltou a foto do condensador.' },
      });
      await t.deliverEmails();
      expect(t.lastEmailTo(tech.user.email)?.text).toContain('Faltou a foto do condensador.');
      const again = await submit();
      expect(again.json().report).toMatchObject({
        status: 'SUBMITTED',
        reworkComment: null,
        defectDescription: null,
      });
      const approved = await t.app.inject({
        method: 'POST',
        url: `/api/v1/appointments/${id}/report/approval`,
        headers: managerHeaders,
        payload: { amountCents: 0 },
      });
      expect(approved.statusCode).toBe(200);
      await t.deliverEmails();
      expect(t.lastEmailTo(customer.email)?.text).toContain('Nenhum defeito encontrado.');
    });

    it('allows only the assigned technician and only in the right state', async () => {
      const tech = await t.as('EMPLOYEE');
      const other = await t.as('EMPLOYEE');
      const { id, managerHeaders } = await scheduledFor(tech.user);
      const payload = { defectFound: false, repairDescription: 'Feito.' };
      const byOther = await t.app.inject({
        method: 'POST',
        url: `/api/v1/appointments/${id}/report`,
        headers: other.headers,
        payload,
      });
      expect(byOther.statusCode).toBe(404);
      const early = await t.app.inject({
        method: 'POST',
        url: `/api/v1/appointments/${id}/report/approval`,
        headers: managerHeaders,
        payload: { amountCents: 100 },
      });
      expect(early.statusCode).toBe(409);
      const earlyRework = await t.app.inject({
        method: 'POST',
        url: `/api/v1/appointments/${id}/report/rework`,
        headers: managerHeaders,
        payload: { comment: 'Ainda não.' },
      });
      expect(earlyRework.statusCode).toBe(409);
      await t.app.inject({
        method: 'POST',
        url: `/api/v1/appointments/${id}/report`,
        headers: tech.headers,
        payload,
      });
      const twice = await t.app.inject({
        method: 'POST',
        url: `/api/v1/appointments/${id}/report`,
        headers: tech.headers,
        payload,
      });
      expect(twice.statusCode).toBe(409);
      const moveAfterReport = await t.app.inject({
        method: 'PATCH',
        url: `/api/v1/appointments/${id}`,
        headers: { ...managerHeaders, 'if-match': 'W/"1"' },
        payload: { startsAt: AT(20).toISOString() },
      });
      expect(moveAfterReport.json().detail).toBe('Só é possível alterar atendimentos ainda não finalizados.');
    });

    it('refuses the report from someone who sees the visit but is not its technician', async () => {
      const { submitReport } = await import('./agenda.js');
      const tech = await t.createUser('EMPLOYEE');
      const { id } = await scheduledFor(tech);
      const manager = await t.createUser('MANAGER');
      await expect(
        submitReport(t.ctx, { userId: manager.id, role: 'MANAGER', sessionId: 's' }, id, {
          defectFound: false,
          repairDescription: 'x',
        }),
      ).rejects.toMatchObject({ status: 403 });
    });

    it('keeps working when people were removed', async () => {
      const tech = await t.as('EMPLOYEE');
      const { id, customer, managerHeaders } = await scheduledFor(tech.user);
      const { anonymizeUser } = await import('../users/service.js');
      await anonymizeUser(t.db, customer.id, t.clock.now());
      const view = await t.app.inject({
        method: 'GET',
        url: `/api/v1/appointments/${id}`,
        headers: managerHeaders,
      });
      expect(view.json().request.customer).toEqual({ id: customer.id, name: 'Conta removida', phone: null });
      await anonymizeUser(t.db, tech.user.id, t.clock.now());
      const admin = await t.as('ADMIN');
      expect(
        (await t.app.inject({ method: 'DELETE', url: `/api/v1/appointments/${id}`, headers: admin.headers }))
          .statusCode,
      ).toBe(204);
      expect(await t.db.select().from(appointments)).toHaveLength(0);
    });
  });
});

function withHeaders(body: ReturnType<typeof multipart>, headers: Record<string, string>) {
  return { payload: body.payload, headers: { ...headers, ...body.headers } };
}
