import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  appointments,
  media,
  serviceReports,
  serviceRequests,
  serviceTypes,
  sessions,
} from '../../infra/db/schema.js';
import { useTestApp } from '../../../test/harness.js';
import { DAY } from '../../shared/clock.js';
import type { RequestStatus } from '../services/service.js';
import { purgeEndedSessions, purgeOldServicePhotos, runRetention } from './service.js';

const ADDRESS = {
  cep: '13800061',
  street: 'Rua Doutor Ulhôa Cintra',
  number: '91',
  complement: null,
  district: 'Centro',
  city: 'Mogi Mirim',
  state: 'SP',
};

describe('data retention', () => {
  const t = useTestApp();
  const daysAgo = (days: number) => new Date(t.clock.now().getTime() - days * DAY);
  const yearsAgo = (years: number, extraDays = 0) => {
    const date = new Date(t.clock.now().getTime() - extraDays * DAY);
    date.setUTCFullYear(date.getUTCFullYear() - years);
    return date;
  };

  async function session(user: { id: number }, values: { expiresAt: Date; revokedAt?: Date }) {
    const [row] = await t.db
      .insert(sessions)
      .values({ userId: user.id, familyId: randomUUID(), refreshTokenHash: randomUUID(), ...values })
      .returning();
    return row!.id;
  }

  async function remainingSessionIds() {
    const rows = await t.db.select({ id: sessions.id }).from(sessions);
    return rows.map((row) => row.id).sort();
  }

  describe('sessions', () => {
    it('deletes sessions expired or revoked more than 30 days ago and keeps the rest', async () => {
      const user = await t.createUser('CLIENT');
      await session(user, { expiresAt: daysAgo(31) });
      await session(user, { expiresAt: daysAgo(90), revokedAt: daysAgo(100) });
      await session(user, { expiresAt: daysAgo(-10), revokedAt: daysAgo(31) });
      const kept = [
        await session(user, { expiresAt: daysAgo(29) }),
        await session(user, { expiresAt: daysAgo(-10) }),
        await session(user, { expiresAt: daysAgo(-10), revokedAt: daysAgo(1) }),
      ];
      expect(await purgeEndedSessions(t.ctx)).toBe(3);
      expect(await remainingSessionIds()).toEqual(kept.sort());
    });
  });

  describe('service photos', () => {
    let people: { customer: { id: number }; employee: { id: number }; serviceTypeId: number };

    async function prepare() {
      const customer = await t.createUser('CLIENT');
      const employee = await t.createUser('EMPLOYEE');
      const [type] = await t.db
        .insert(serviceTypes)
        .values({ name: `Manutenção ${randomUUID()}`, estimatedMinutes: 60 })
        .returning();
      people = { customer, employee, serviceTypeId: type!.id };
    }

    async function request(status: RequestStatus, updatedAt: Date) {
      const [row] = await t.db
        .insert(serviceRequests)
        .values({
          customerId: people.customer.id,
          serviceTypeId: people.serviceTypeId,
          productKind: 'Geladeira',
          problem: 'Não gela.',
          address: ADDRESS,
          status,
          createdById: people.customer.id,
          updatedAt,
        })
        .returning();
      return row!.id;
    }

    async function report(serviceRequestId: number) {
      const startsAt = daysAgo(3000);
      const [appointment] = await t.db
        .insert(appointments)
        .values({
          serviceRequestId,
          employeeId: people.employee.id,
          startsAt,
          endsAt: new Date(startsAt.getTime() + DAY / 24),
          createdById: people.employee.id,
        })
        .returning();
      const [row] = await t.db
        .insert(serviceReports)
        .values({ appointmentId: appointment!.id, defectFound: false, repairDescription: 'Limpeza.' })
        .returning();
      return row!.id;
    }

    async function photo(
      ownerType: 'SERVICE_REQUEST' | 'SERVICE_REPORT' | 'QUOTE',
      ownerId: number,
      key: string,
    ) {
      await t.ctx.storage.put(`${key}/320.webp`, Buffer.from(key));
      await t.db.insert(media).values({ ownerType, ownerId, storageKey: key, width: 320, height: 240 });
    }

    async function remainingKeys() {
      const rows = await t.db.select({ key: media.storageKey }).from(media);
      return rows.map((row) => row.key).sort();
    }

    const stored = async (key: string) => (await t.ctx.storage.get(`${key}/320.webp`)) !== null;

    it('removes the photos of services finished more than 5 years ago, with their files', async () => {
      await prepare();
      const completed = await request('COMPLETED', yearsAgo(5, 1));
      await photo('SERVICE_REQUEST', completed, 'old-request');
      await photo('SERVICE_REPORT', await report(completed), 'old-report');
      await photo('SERVICE_REQUEST', await request('CANCELED', yearsAgo(6)), 'old-canceled');
      await photo('SERVICE_REQUEST', await request('REJECTED', yearsAgo(7)), 'old-rejected');
      expect(await purgeOldServicePhotos(t.ctx)).toBe(4);
      expect(await remainingKeys()).toEqual([]);
      for (const key of ['old-request', 'old-report', 'old-canceled', 'old-rejected']) {
        expect(await stored(key)).toBe(false);
      }
    });

    it('keeps recent, unfinished and quote photos, and files still used elsewhere', async () => {
      await prepare();
      const old = await request('COMPLETED', yearsAgo(5, 1));
      await photo('SERVICE_REQUEST', old, 'shared-photo');
      await photo('QUOTE', old, 'quote-photo');
      const recent = await request('COMPLETED', yearsAgo(4));
      await photo('SERVICE_REQUEST', recent, 'shared-photo');
      await photo('SERVICE_REPORT', await report(recent), 'recent-report');
      await photo('SERVICE_REQUEST', await request('SCHEDULED', yearsAgo(6)), 'open-request');
      expect(await purgeOldServicePhotos(t.ctx)).toBe(1);
      expect(await remainingKeys()).toEqual(['open-request', 'quote-photo', 'recent-report', 'shared-photo']);
      expect(await stored('shared-photo')).toBe(true);
    });

    it('runs every task and reports what each one removed', async () => {
      await prepare();
      await session(people.customer, { expiresAt: daysAgo(40) });
      await photo('SERVICE_REQUEST', await request('COMPLETED', yearsAgo(6)), 'old-photo');
      expect(await runRetention(t.ctx)).toEqual({ sessions: 1, photos: 1 });
      expect(await runRetention(t.ctx)).toEqual({ sessions: 0, photos: 0 });
    });
  });
});
