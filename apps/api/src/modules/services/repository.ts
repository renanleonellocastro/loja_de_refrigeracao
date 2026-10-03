import { and, asc, count, desc, eq, ilike, inArray, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Executor } from '../../infra/db/client.js';
import {
  appointments,
  availabilityWindows,
  media,
  messages,
  quotes,
  serviceRequests,
  serviceTypes,
  users,
} from '../../infra/db/schema.js';
import { normalizeText } from '../../shared/text.js';
import type { RequestStatus } from './status.js';

export type ServiceTypeRow = typeof serviceTypes.$inferSelect;
export type RequestRow = typeof serviceRequests.$inferSelect;
type ThreadType = (typeof messages.$inferSelect)['threadType'];
type MediaOwner = (typeof media.$inferSelect)['ownerType'];

// Service types

export async function listServiceTypes(db: Executor, includeInactive: boolean): Promise<ServiceTypeRow[]> {
  return db
    .select()
    .from(serviceTypes)
    .where(includeInactive ? undefined : eq(serviceTypes.active, true))
    .orderBy(asc(serviceTypes.position), asc(serviceTypes.name));
}

export async function findServiceType(db: Executor, id: number): Promise<ServiceTypeRow | undefined> {
  const [row] = await db.select().from(serviceTypes).where(eq(serviceTypes.id, id)).limit(1);
  return row;
}

export async function findServiceTypeByName(db: Executor, name: string): Promise<ServiceTypeRow | undefined> {
  const [row] = await db
    .select()
    .from(serviceTypes)
    .where(sql`lower(${serviceTypes.name}) = ${name.toLowerCase()}`)
    .limit(1);
  return row;
}

export async function insertServiceType(db: Executor, values: typeof serviceTypes.$inferInsert) {
  const [row] = await db.insert(serviceTypes).values(values).returning();
  return row!;
}

export async function updateServiceType(
  db: Executor,
  id: number,
  values: Partial<typeof serviceTypes.$inferInsert>,
) {
  const [row] = await db.update(serviceTypes).set(values).where(eq(serviceTypes.id, id)).returning();
  return row!;
}

export async function deleteServiceType(db: Executor, id: number): Promise<void> {
  await db.delete(serviceTypes).where(eq(serviceTypes.id, id));
}

export async function isServiceTypeInUse(db: Executor, id: number): Promise<boolean> {
  const [requests, quoteRows] = await Promise.all([
    db.select({ value: count() }).from(serviceRequests).where(eq(serviceRequests.serviceTypeId, id)),
    db.select({ value: count() }).from(quotes).where(eq(quotes.serviceTypeId, id)),
  ]);
  return requests[0]!.value + quoteRows[0]!.value > 0;
}

// Service requests

export async function insertRequest(
  db: Executor,
  values: typeof serviceRequests.$inferInsert,
): Promise<RequestRow> {
  const [row] = await db.insert(serviceRequests).values(values).returning();
  return row!;
}

export async function insertWindows(
  db: Executor,
  requestId: number,
  windows: Array<{ day: string; period: 'MORNING' | 'AFTERNOON' }>,
) {
  await db.insert(availabilityWindows).values(windows.map((w) => ({ serviceRequestId: requestId, ...w })));
}

export async function findRequest(db: Executor, id: number): Promise<RequestRow | undefined> {
  const [row] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, id)).limit(1);
  return row;
}

export async function updateRequest(
  db: Executor,
  id: number,
  values: Partial<typeof serviceRequests.$inferInsert>,
) {
  const [row] = await db.update(serviceRequests).set(values).where(eq(serviceRequests.id, id)).returning();
  return row!;
}

export async function findAppointmentForRequest(db: Executor, requestId: number) {
  const [row] = await db
    .select({
      id: appointments.id,
      employeeId: appointments.employeeId,
      employeeName: users.name,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
    })
    .from(appointments)
    .innerJoin(users, eq(users.id, appointments.employeeId))
    .where(eq(appointments.serviceRequestId, requestId))
    .limit(1);
  return row;
}

export async function deleteAppointmentForRequest(db: Executor, requestId: number): Promise<void> {
  await db.delete(appointments).where(eq(appointments.serviceRequestId, requestId));
}

export async function listWindows(db: Executor, requestId: number) {
  return db
    .select({ day: availabilityWindows.day, period: availabilityWindows.period })
    .from(availabilityWindows)
    .where(eq(availabilityWindows.serviceRequestId, requestId))
    .orderBy(asc(availabilityWindows.day), asc(availabilityWindows.period));
}

export interface RequestFilters {
  customerId?: number | undefined;
  employeeId?: number | undefined;
  statuses?: RequestStatus[] | undefined;
  q?: string | undefined;
  limit: number;
  offset: number;
}

export async function listRequests(db: Executor, filters: RequestFilters) {
  const customer = alias(users, 'customer');
  const employee = alias(users, 'employee');
  const conditions: SQL[] = [];
  if (filters.customerId !== undefined) conditions.push(eq(serviceRequests.customerId, filters.customerId));
  if (filters.employeeId !== undefined) conditions.push(eq(appointments.employeeId, filters.employeeId));
  if (filters.statuses?.length) conditions.push(inArray(serviceRequests.status, filters.statuses));
  if (filters.q) {
    // A number searches the request number; anything else searches the customer.
    conditions.push(
      /^\d+$/.test(filters.q)
        ? eq(serviceRequests.id, Number(filters.q))
        : ilike(customer.searchText, `%${normalizeText(filters.q).replace(/[%_]/g, '')}%`),
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const rows = await db
    .select({
      id: serviceRequests.id,
      status: serviceRequests.status,
      serviceType: serviceTypes.name,
      productKind: serviceRequests.productKind,
      customerId: customer.id,
      customerName: customer.name,
      scheduledFor: appointments.startsAt,
      employeeId: employee.id,
      employeeName: employee.name,
      createdAt: serviceRequests.createdAt,
      updatedAt: serviceRequests.updatedAt,
    })
    .from(serviceRequests)
    .innerJoin(serviceTypes, eq(serviceTypes.id, serviceRequests.serviceTypeId))
    .innerJoin(customer, eq(customer.id, serviceRequests.customerId))
    .leftJoin(appointments, eq(appointments.serviceRequestId, serviceRequests.id))
    .leftJoin(employee, eq(employee.id, appointments.employeeId))
    .where(where)
    .orderBy(desc(serviceRequests.updatedAt), desc(serviceRequests.id))
    .limit(filters.limit)
    .offset(filters.offset);
  const totals = await db
    .select({ value: count() })
    .from(serviceRequests)
    .innerJoin(customer, eq(customer.id, serviceRequests.customerId))
    .leftJoin(appointments, eq(appointments.serviceRequestId, serviceRequests.id))
    .where(where);
  return { rows, total: totals[0]!.value };
}

// Messages and media (shared by service requests and quotes)

export async function insertMessage(
  db: Executor,
  threadType: ThreadType,
  threadId: number,
  authorId: number,
  body: string,
  at: Date,
) {
  await db.insert(messages).values({ threadType, threadId, authorId, body, createdAt: at });
}

export async function listMessages(db: Executor, threadType: ThreadType, threadId: number) {
  return db
    .select({
      id: messages.id,
      body: messages.body,
      authorId: users.id,
      authorName: users.name,
      authorRole: users.role,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(users, eq(users.id, messages.authorId))
    .where(and(eq(messages.threadType, threadType), eq(messages.threadId, threadId)))
    .orderBy(asc(messages.createdAt), asc(messages.id));
}

export async function insertMedia(
  db: Executor,
  ownerType: MediaOwner,
  ownerId: number,
  image: { key: string; width: number; height: number },
) {
  await db
    .insert(media)
    .values({ ownerType, ownerId, storageKey: image.key, width: image.width, height: image.height });
}

export async function listMedia(db: Executor, ownerType: MediaOwner, ownerId: number) {
  return db
    .select()
    .from(media)
    .where(and(eq(media.ownerType, ownerType), eq(media.ownerId, ownerId)))
    .orderBy(asc(media.id));
}
