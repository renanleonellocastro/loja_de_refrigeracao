import { describe, expect, it } from 'vitest';
import {
  appointments,
  orders,
  quotes,
  serviceReports,
  serviceRequests,
  serviceTypes,
} from '../../infra/db/schema.js';
import { createCategory, createProduct } from '../../../test/catalog.js';
import { useTestApp } from '../../../test/harness.js';
import { storePeriods } from './dashboard.js';

const ADDRESS = {
  cep: '13800061',
  street: 'Rua Doutor Ulhoa Cintra',
  number: '91',
  complement: null,
  district: 'Centro',
  city: 'Mogi Mirim',
  state: 'SP',
};

// The test clock starts on 2026-10-05 12:00 UTC, 09:00 of a Monday in São Paulo.
const at = (iso: string) => new Date(iso);

describe('dashboard', () => {
  const t = useTestApp();

  async function seed() {
    const customer = await t.createUser('CLIENT');
    const ana = await t.createUser('EMPLOYEE', { name: 'Ana Técnica' });
    const bruno = await t.createUser('EMPLOYEE', { name: 'Bruno Técnico' });
    const [type] = await t.db
      .insert(serviceTypes)
      .values({ name: 'Conserto de geladeira', estimatedMinutes: 60 })
      .returning();

    const order = (status: 'PENDING_REVIEW' | 'CANCELED') => ({
      customerId: customer.id,
      channel: 'ONLINE' as const,
      status,
      totalCents: 1000,
      createdById: customer.id,
    });
    await t.db.insert(orders).values([order('PENDING_REVIEW'), order('PENDING_REVIEW'), order('CANCELED')]);

    const quote = (status: 'REQUESTED' | 'ANSWERED') => ({
      customerId: customer.id,
      serviceTypeId: type!.id,
      description: 'Instalar ar.',
      status,
      createdById: customer.id,
    });
    await t.db.insert(quotes).values([quote('REQUESTED'), quote('ANSWERED')]);

    const request = async (status: (typeof serviceRequests.$inferSelect)['status']) => {
      const [row] = await t.db
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
      return row!;
    };
    await request('REQUESTED');
    await request('AWAITING_CUSTOMER');
    await request('AWAITING_CUSTOMER');

    const visit = async (
      employeeId: number,
      startsAt: string,
      status: 'SCHEDULED' | 'AWAITING_COMPLETION_APPROVAL' | 'COMPLETED' = 'SCHEDULED',
    ) => {
      const { id } = await request(status);
      const start = at(startsAt);
      const [row] = await t.db
        .insert(appointments)
        .values({
          serviceRequestId: id,
          employeeId,
          startsAt: start,
          endsAt: new Date(start.getTime() + 3_600_000),
          createdById: customer.id,
        })
        .returning();
      return row!;
    };
    const submitted = await visit(ana.id, '2026-10-05T16:00:00.000Z', 'AWAITING_COMPLETION_APPROVAL');
    await t.db
      .insert(serviceReports)
      .values({ appointmentId: submitted.id, defectFound: false, repairDescription: 'Limpeza.' });
    await visit(bruno.id, '2026-10-05T13:00:00.000Z');
    await visit(ana.id, '2026-10-05T12:00:00.000Z');
    await visit(bruno.id, '2026-10-02T13:00:00.000Z');
    await visit(bruno.id, '2026-10-06T13:00:00.000Z');

    const approved = async (day: number, approvedAt: string, amountCents: number) => {
      const row = await visit(ana.id, `2026-09-${day}T13:00:00.000Z`, 'COMPLETED');
      await t.db.insert(serviceReports).values({
        appointmentId: row.id,
        status: 'APPROVED',
        defectFound: true,
        repairDescription: 'Troca do relé.',
        amountCents,
        approvedAt: at(approvedAt),
      });
    };
    await approved(20, '2026-10-01T03:00:00.000Z', 15_000);
    await approved(21, '2026-10-04T18:00:00.000Z', 5_050);
    await approved(22, '2026-10-01T02:59:00.000Z', 99_999);

    return { ana, bruno };
  }

  it('gives management the store indicators, the agenda by technician and the low stock', async () => {
    await seed();
    const { headers } = await t.as('MANAGER');
    const category = await createCategory(t, 'Geladeiras');
    await createProduct(t, headers, { name: 'Zeta', categoryId: category.id, initialStock: 1, stockMin: 3 });
    await createProduct(t, headers, { name: 'Alfa', categoryId: category.id, initialStock: 1, stockMin: 2 });
    await createProduct(t, headers, { name: 'Cheio', categoryId: category.id, initialStock: 9, stockMin: 2 });

    const response = await t.app.inject({ method: 'GET', url: '/api/v1/dashboard', headers });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.date).toBe('2026-10-05');
    expect(body.employee).toBeNull();
    expect(body.management).toMatchObject({
      ordersByStatus: { PENDING_REVIEW: 2, READY_FOR_PICKUP: 0, PICKED_UP: 0, CANCELED: 1 },
      openServiceRequests: { REQUESTED: 1, AWAITING_CUSTOMER: 2 },
      quotesAwaitingAnswer: 1,
      reportsAwaitingApproval: 1,
      serviceRevenueMonthCents: 20_050,
      lowStock: {
        total: 2,
        items: [
          { name: 'Alfa', stockAvailable: 1, stockMin: 2 },
          { name: 'Zeta', stockAvailable: 1, stockMin: 3 },
        ],
      },
    });
    const agenda = body.management.agendaToday as Array<{
      employee: { name: string };
      appointments: Array<{ startsAt: string }>;
    }>;
    expect(agenda.map((group) => group.employee.name)).toEqual(['Ana Técnica', 'Bruno Técnico']);
    expect(agenda[0]!.appointments.map((visit) => visit.startsAt)).toEqual([
      '2026-10-05T12:00:00.000Z',
      '2026-10-05T16:00:00.000Z',
    ]);
    expect(agenda[1]!.appointments).toHaveLength(1);
  });

  it('gives the technician only the own visits of the day and the pending reports', async () => {
    const { bruno } = await seed();
    const { headers } = await t.as('EMPLOYEE');
    const empty = await t.app.inject({ method: 'GET', url: '/api/v1/dashboard', headers });
    expect(empty.json()).toMatchObject({
      management: null,
      employee: { visitsToday: [], pendingReports: 0 },
    });

    const { token } = await t.login(bruno);
    const own = await t.app.inject({
      method: 'GET',
      url: '/api/v1/dashboard',
      headers: { authorization: `Bearer ${token}` },
    });
    const body = own.json();
    expect(body.employee.pendingReports).toBe(2);
    expect(body.employee.visitsToday).toHaveLength(1);
    expect(body.employee.visitsToday[0].employee.name).toBe('Bruno Técnico');
  });

  it('computes the store day and month in São Paulo time', () => {
    expect(storePeriods(at('2026-10-01T02:30:00.000Z'))).toEqual({
      date: '2026-09-30',
      dayStart: at('2026-09-30T03:00:00.000Z'),
      dayEnd: at('2026-10-01T03:00:00.000Z'),
      monthStart: at('2026-09-01T03:00:00.000Z'),
    });
  });
});
