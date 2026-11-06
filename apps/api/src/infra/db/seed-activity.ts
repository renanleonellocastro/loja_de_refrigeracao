import { eq, inArray, sql } from 'drizzle-orm';
import { hashPassword } from '../../modules/auth/passwords.js';
import { saoPauloDate } from '../../modules/services/status.js';
import { userSearchText } from '../../modules/users/repository.js';
import { HOUR, MINUTE } from '../../shared/clock.js';
import type { Storage } from '../storage/storage.js';
import type { Database, Transaction } from './client.js';
import {
  addresses,
  appointments,
  availabilityWindows,
  media,
  messages,
  orderEvents,
  orderItems,
  orders,
  products,
  quotes,
  serviceReports,
  serviceRequests,
  serviceTypes,
  stockMovements,
  users,
  type AddressSnapshot,
} from './schema.js';
import { SAMPLE_PASSWORD, renderPhotos, type Illustration, type Photos } from './seed.js';
import {
  BASE_CUSTOMER_EMAIL,
  SAMPLE_CUSTOMERS,
  SAMPLE_ORDERS,
  SAMPLE_QUOTES,
  SAMPLE_REQUESTS,
  STAFF_EMAIL,
  type OrderStatus,
  type SampleMessage,
  type SampleOrder,
  type SampleQuote,
  type SampleReport,
  type SampleRequest,
  type SampleVisit,
} from './seed-activity-data.js';

interface Activity {
  readonly tx: Transaction;
  readonly now: Date;
  readonly photos: Photos;
  readonly userIds: ReadonlyMap<string, number>;
  readonly productsByName: ReadonlyMap<string, { id: number; priceCents: number }>;
  readonly serviceTypeIds: ReadonlyMap<string, number>;
  readonly quoteIds: number[];
}

type OrderLine = { productId: number; productName: string; unitPriceCents: number; quantity: number };
type ThreadType = 'SERVICE_REQUEST' | 'QUOTE';
type MediaOwner = ThreadType | 'SERVICE_REPORT';

const ONLINE_PATHS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_REVIEW: ['PENDING_REVIEW'],
  READY_FOR_PICKUP: ['PENDING_REVIEW', 'READY_FOR_PICKUP'],
  PICKED_UP: ['PENDING_REVIEW', 'READY_FOR_PICKUP', 'PICKED_UP'],
  CANCELED: ['PENDING_REVIEW', 'CANCELED'],
};
const COUNTER_PATH: OrderStatus[] = ['PICKED_UP'];
const ACTIVITY_ILLUSTRATIONS: Illustration[] = [
  ...SAMPLE_REQUESTS.flatMap((sample) => [sample.photo, sample.visit?.report?.photo]),
  ...SAMPLE_QUOTES.map((sample) => sample.photo),
].filter((photo): photo is Illustration => photo !== undefined);

/** Two hours before now, `day` days away (the day is zero or negative). */
function createdOn(now: Date, day: number): Date {
  return new Date(now.getTime() + day * 24 * HOUR - 2 * HOUR);
}

/** A whole hour of a store day in São Paulo (UTC-3). */
export function storeTime(now: Date, day: number, hour: number): Date {
  return new Date(`${saoPauloDate(now, day)}T${String(hour).padStart(2, '0')}:00:00-03:00`);
}

function later(date: Date, steps: number, step = HOUR): Date {
  return new Date(date.getTime() + steps * step);
}

const idOf = (ids: ReadonlyMap<string, number>, key: string) => ids.get(key)!;

// Customers -------------------------------------------------------------------------------------

function newCustomerValues(passwordHash: string, now: Date) {
  return SAMPLE_CUSTOMERS.filter((customer) => customer.email !== BASE_CUSTOMER_EMAIL).map(
    ({ name, email, phone }) => ({
      role: 'CLIENT' as const,
      ...{ name, email, phone, passwordHash, emailVerifiedAt: now },
      searchText: userSearchText({ name, email, phone }),
    }),
  );
}

async function userIdsByEmail(tx: Transaction): Promise<Map<string, number>> {
  const emails = [...SAMPLE_CUSTOMERS.map((customer) => customer.email), ...Object.values(STAFF_EMAIL)];
  const rows = await tx
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(users.email, emails));
  return new Map(rows.map((row) => [row.email, row.id]));
}

/** The new customers and the address of every sample customer (an address already saved stays). */
async function insertCustomers(tx: Transaction, passwordHash: string, now: Date) {
  await tx.insert(users).values(newCustomerValues(passwordHash, now));
  const userIds = await userIdsByEmail(tx);
  const rows = SAMPLE_CUSTOMERS.map(({ email, address }) => ({ userId: idOf(userIds, email), ...address }));
  await tx.insert(addresses).values(rows).onConflictDoNothing();
  return userIds;
}

async function loadActivity(
  tx: Transaction,
  passwordHash: string,
  photos: Photos,
  now: Date,
): Promise<Activity> {
  const userIds = await insertCustomers(tx, passwordHash, now);
  const productRows = await tx.select().from(products);
  const typeRows = await tx.select().from(serviceTypes);
  return {
    ...{ tx, now, photos, userIds, quoteIds: [] },
    productsByName: new Map(productRows.map(({ id, name, priceCents }) => [name, { id, priceCents }])),
    serviceTypeIds: new Map(typeRows.map((row) => [row.name, row.id])),
  };
}

// Shared pieces ---------------------------------------------------------------------------------

async function attachPhoto(activity: Activity, ownerType: MediaOwner, ownerId: number, photo?: Illustration) {
  const image = photo && activity.photos.get(photo);
  if (!image) return;
  const { key: storageKey, width, height } = image;
  await activity.tx.insert(media).values({ ownerType, ownerId, storageKey, width, height });
}

async function insertMessages(
  activity: Activity,
  thread: [ThreadType, number],
  start: Date,
  list?: SampleMessage[],
) {
  const [threadType, threadId] = thread;
  for (const [index, { from, body }] of (list ?? []).entries()) {
    const createdAt = later(start, index + 1, 30 * MINUTE);
    await activity.tx
      .insert(messages)
      .values({ threadType, threadId, authorId: idOf(activity.userIds, from), body, createdAt });
  }
}

// Orders ----------------------------------------------------------------------------------------

function orderLine(activity: Activity, item: SampleOrder['items'][number]): OrderLine {
  const product = activity.productsByName.get(item.product)!;
  return {
    productId: product.id,
    productName: item.product,
    unitPriceCents: product.priceCents,
    quantity: item.quantity,
  };
}

function orderPath(sample: SampleOrder): OrderStatus[] {
  return sample.channel === 'COUNTER' ? COUNTER_PATH : ONLINE_PATHS[sample.status];
}

function eventActor(activity: Activity, sample: SampleOrder, toStatus: OrderStatus, index: number): number {
  const customerId = idOf(activity.userIds, sample.customer);
  if (index === 0 && sample.channel === 'COUNTER') return idOf(activity.userIds, STAFF_EMAIL.employee);
  if (index === 0 || toStatus === 'CANCELED') return customerId;
  return idOf(activity.userIds, STAFF_EMAIL.manager);
}

async function insertOrderEvents(activity: Activity, sample: SampleOrder, orderId: number, createdAt: Date) {
  const path = orderPath(sample);
  const events = path.map((toStatus, index) => ({
    ...{ orderId, toStatus, fromStatus: index === 0 ? null : path[index - 1]! },
    actorId: eventActor(activity, sample, toStatus, index),
    reason: toStatus === 'CANCELED' ? sample.cancelReason! : null,
    createdAt: later(createdAt, index),
  }));
  await activity.tx.insert(orderEvents).values(events);
}

type Movement = { type: 'RESERVATION' | 'RELEASE'; quantity: number };

function movementsOf(quantity: number, canceled: boolean): Movement[] {
  const reservation: Movement = { type: 'RESERVATION', quantity: -quantity };
  return canceled ? [reservation, { type: 'RELEASE', quantity }] : [reservation];
}

async function takeStock(tx: Transaction, productId: number, quantity: number) {
  const stockAvailable = sql`${products.stockAvailable} - ${quantity}`;
  await tx.update(products).set({ stockAvailable }).where(eq(products.id, productId));
}

/** Reserves the stock like a placed order; a canceled order gives it back. */
async function moveStock(
  activity: Activity,
  sample: SampleOrder,
  link: { orderId: number; createdAt: Date },
  lines: OrderLine[],
) {
  const canceled = sample.status === 'CANCELED';
  for (const { productId, quantity } of lines) {
    if (!canceled) await takeStock(activity.tx, productId, quantity);
    const rows = movementsOf(quantity, canceled).map((movement) => ({ productId, ...link, ...movement }));
    await activity.tx.insert(stockMovements).values(rows);
  }
}

function orderValues(activity: Activity, sample: SampleOrder, lines: OrderLine[], createdAt: Date) {
  const { customer, channel, status, notes } = sample;
  const createdBy = channel === 'COUNTER' ? STAFF_EMAIL.employee : customer;
  const updatedAt = later(createdAt, orderPath(sample).length - 1);
  return {
    ...{ channel, status, notes: notes ?? null, createdAt, updatedAt },
    customerId: idOf(activity.userIds, customer),
    createdById: idOf(activity.userIds, createdBy),
    totalCents: lines.reduce((total, line) => total + line.unitPriceCents * line.quantity, 0),
  };
}

async function insertOrder(activity: Activity, sample: SampleOrder) {
  const lines = sample.items.map((item) => orderLine(activity, item));
  const createdAt = createdOn(activity.now, sample.day);
  const [order] = await activity.tx
    .insert(orders)
    .values(orderValues(activity, sample, lines, createdAt))
    .returning();
  await activity.tx.insert(orderItems).values(lines.map((line) => ({ orderId: order!.id, ...line })));
  await insertOrderEvents(activity, sample, order!.id, createdAt);
  await moveStock(activity, sample, { orderId: order!.id, createdAt }, lines);
}

const DECIDED_QUOTES: ReadonlySet<string> = new Set(['ACCEPTED', 'DECLINED']);

// Quotes ----------------------------------------------------------------------------------------

function answerValues(activity: Activity, sample: SampleQuote, createdAt: Date) {
  if (!sample.answer) return {};
  const { amountCents, validDays, included, notes } = sample.answer;
  const answeredAt = later(createdAt, 2);
  return {
    ...{ amountCents, included, notes: notes ?? null, answeredAt },
    decidedAt: DECIDED_QUOTES.has(sample.status) ? later(answeredAt, 3) : null,
    validUntil: saoPauloDate(activity.now, sample.day + validDays),
    answeredById: idOf(activity.userIds, STAFF_EMAIL.manager),
  };
}

function quoteValues(activity: Activity, sample: SampleQuote, createdAt: Date) {
  const customerId = idOf(activity.userIds, sample.customer);
  const { description, status, declineReason } = sample;
  return {
    ...{ customerId, createdById: customerId, description, status, declineReason: declineReason ?? null },
    serviceTypeId: idOf(activity.serviceTypeIds, sample.serviceType),
    ...{ createdAt, updatedAt: later(createdAt, sample.answer ? 5 : 1) },
    ...answerValues(activity, sample, createdAt),
  };
}

async function insertQuote(activity: Activity, sample: SampleQuote) {
  const createdAt = createdOn(activity.now, sample.day);
  const [quote] = await activity.tx
    .insert(quotes)
    .values(quoteValues(activity, sample, createdAt))
    .returning();
  activity.quoteIds.push(quote!.id);
  await attachPhoto(activity, 'QUOTE', quote!.id, sample.photo);
  await insertMessages(activity, ['QUOTE', quote!.id], createdAt, sample.messages);
}

// Service requests ------------------------------------------------------------------------------

function requestValues(activity: Activity, sample: SampleRequest, address: AddressSnapshot, createdAt: Date) {
  const customerId = idOf(activity.userIds, sample.customer);
  const { status, productKind, brand, model, problem } = sample;
  return {
    ...{ customerId, createdById: customerId, status, productKind, brand, model, problem, address },
    serviceTypeId: idOf(activity.serviceTypeIds, sample.serviceType),
    quoteId: sample.quote === undefined ? null : activity.quoteIds[sample.quote]!,
    rejectionReason: sample.rejectionReason ?? null,
    cancellationReason: sample.cancellationReason ?? null,
    ...{ createdAt, updatedAt: later(createdAt, 1) },
  };
}

function reportValues(activity: Activity, report: SampleReport, appointmentId: number, endsAt: Date) {
  const approved = report.status === 'APPROVED';
  const { status, defectDescription, repairDescription, amountCents } = report;
  return {
    ...{ appointmentId, status, defectFound: true, defectDescription, repairDescription, amountCents },
    submittedAt: endsAt,
    approvedById: approved ? idOf(activity.userIds, STAFF_EMAIL.manager) : null,
    approvedAt: approved ? later(endsAt, 2) : null,
  };
}

async function insertReport(activity: Activity, report: SampleReport, appointmentId: number, endsAt: Date) {
  const [row] = await activity.tx
    .insert(serviceReports)
    .values(reportValues(activity, report, appointmentId, endsAt))
    .returning();
  await attachPhoto(activity, 'SERVICE_REPORT', row!.id, report.photo);
}

function appointmentValues(
  activity: Activity,
  visit: SampleVisit,
  serviceRequestId: number,
  createdAt: Date,
) {
  const startsAt = storeTime(activity.now, visit.day, visit.startHour);
  const scheduledAt = later(createdAt, 1);
  return {
    ...{ serviceRequestId, startsAt, endsAt: later(startsAt, visit.hours) },
    ...{ createdAt: scheduledAt, updatedAt: scheduledAt },
    employeeId: idOf(activity.userIds, STAFF_EMAIL.employee),
    createdById: idOf(activity.userIds, STAFF_EMAIL.manager),
  };
}

async function insertVisit(
  activity: Activity,
  visit: SampleVisit,
  serviceRequestId: number,
  createdAt: Date,
) {
  const values = appointmentValues(activity, visit, serviceRequestId, createdAt);
  const [appointment] = await activity.tx.insert(appointments).values(values).returning();
  if (visit.report) await insertReport(activity, visit.report, appointment!.id, values.endsAt);
}

async function insertWindows(activity: Activity, sample: SampleRequest, serviceRequestId: number) {
  const windows = sample.windows.map(({ day, period }) => ({
    ...{ serviceRequestId, period },
    day: saoPauloDate(activity.now, day),
  }));
  await activity.tx.insert(availabilityWindows).values(windows);
}

async function insertRequest(activity: Activity, sample: SampleRequest, address: AddressSnapshot) {
  const createdAt = createdOn(activity.now, sample.day);
  const [request] = await activity.tx
    .insert(serviceRequests)
    .values(requestValues(activity, sample, address, createdAt))
    .returning();
  const id = request!.id;
  await insertWindows(activity, sample, id);
  await attachPhoto(activity, 'SERVICE_REQUEST', id, sample.photo);
  await insertMessages(activity, ['SERVICE_REQUEST', id], createdAt, sample.messages);
  if (sample.visit) await insertVisit(activity, sample.visit, id, createdAt);
}

// Entry point -----------------------------------------------------------------------------------

async function insertActivity(activity: Activity): Promise<void> {
  const addressOf = new Map(SAMPLE_CUSTOMERS.map((customer) => [customer.email, customer.address]));
  for (const sample of SAMPLE_ORDERS) await insertOrder(activity, sample);
  for (const sample of SAMPLE_QUOTES) await insertQuote(activity, sample);
  for (const sample of SAMPLE_REQUESTS)
    await insertRequest(activity, sample, addressOf.get(sample.customer)!);
}

async function hasSampleActivity(db: Database): Promise<boolean> {
  const marker = SAMPLE_CUSTOMERS.find((customer) => customer.email !== BASE_CUSTOMER_EMAIL)!;
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, marker.email));
  return existing !== undefined;
}

/**
 * Adds the sample customers with orders, quotes and service requests in every state to a development
 * database that already has the base data and the catalog (see seedDevelopment). Runs once: returns
 * false when the sample customers already exist. Photos only when a storage is given.
 */
export async function seedSampleActivity(
  db: Database,
  storage?: Storage,
  now = new Date(),
): Promise<boolean> {
  if (await hasSampleActivity(db)) return false;
  const photos = await renderPhotos(storage, ACTIVITY_ILLUSTRATIONS);
  const passwordHash = await hashPassword(SAMPLE_PASSWORD);
  await db.transaction(async (tx) => insertActivity(await loadActivity(tx, passwordHash, photos, now)));
  return true;
}
