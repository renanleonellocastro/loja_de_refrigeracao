import { expect, type APIRequestContext } from '@playwright/test';
import { API, as, call, type Account } from './api.js';

// Store steps driven through the API, so each per RF spec reaches its own step quickly and checks it in the UI.

interface Created {
  readonly id: number;
}

interface Named extends Created {
  readonly name: string;
}

interface NumberedOrder extends Created {
  readonly number: string;
}

// Two days ahead, so the visit window is still accepted when the test runs across midnight.
const LEAD_DAYS = 2;
// A visit takes 2h, so 3h apart keeps the slots of a day disjoint.
const SLOTS_PER_DAY = 3;
const SLOT_HOURS = 3;
const FIRST_HOUR = 8;
const VISIT_ADDRESS = {
  cep: '13800061',
  street: 'Rua Doutor Ulhôa Cintra',
  number: '91',
  district: 'Centro',
  city: 'Mogi Mirim',
  state: 'SP',
};
export const FRIDGE_REPAIR = 'Conserto de geladeira';

/** YYYY-MM-DD in São Paulo, `days` from today. */
function dayFromToday(days: number): string {
  const date = new Date(Date.now() + days * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(date);
}

/**
 * Start of the visit for a request. Request ids never repeat in the E2E database, so devices, retries and repeated
 * runs each get their own slot and never find the technician busy (the same rule as agenda.spec.ts).
 */
function visitStart(requestId: number): string {
  const day = dayFromToday(LEAD_DAYS + Math.floor(requestId / SLOTS_PER_DAY));
  const hour = String(FIRST_HOUR + (requestId % SLOTS_PER_DAY) * SLOT_HOURS).padStart(2, '0');
  return `${day}T${hour}:00:00-03:00`;
}

/** Id of a service type of the seed, by name. */
export async function serviceTypeId(request: APIRequestContext, name: string): Promise<number> {
  const types = await call<Named[]>(request.get(`${API}/api/v1/service-types`));
  return types.find((type) => type.name === name)!.id;
}

/** A product with plenty of stock in the first category, so orders never run out. */
export async function newProduct(request: APIRequestContext, admin: Account, name: string): Promise<Named> {
  const categories = await call<Created[]>(request.get(`${API}/api/v1/categories`));
  const data = { name, categoryId: categories[0]!.id, priceCents: 12_990, initialStock: 50 };
  return call<Named>(request.post(`${API}/api/v1/products`, { headers: as(admin, true), data }));
}

/** An order the customer places from the cart, with one unit of the product. */
export async function placeOrder(
  request: APIRequestContext,
  customer: Account,
  productId: number,
): Promise<NumberedOrder> {
  const item = `${API}/api/v1/me/cart/items/${productId}`;
  await call(request.put(item, { headers: as(customer), data: { quantity: 1 } }));
  return call<NumberedOrder>(request.post(`${API}/api/v1/orders`, { headers: as(customer, true), data: {} }));
}

/** A counter sale the staff registers for the customer. */
export function sellAtCounter(
  request: APIRequestContext,
  staff: Account,
  customer: Account,
  productId: number,
): Promise<NumberedOrder> {
  const data = { customerId: customer.id, items: [{ productId, quantity: 1 }] };
  return call<NumberedOrder>(request.post(`${API}/api/v1/counter-sales`, { headers: as(staff, true), data }));
}

/** A fridge repair request from the customer, with one afternoon window. */
export async function requestService(
  request: APIRequestContext,
  customer: Account,
  problem: string,
): Promise<number> {
  const data = {
    serviceTypeId: await serviceTypeId(request, FRIDGE_REPAIR),
    productKind: 'Geladeira duplex',
    problem,
    windows: [{ day: dayFromToday(LEAD_DAYS), period: 'AFTERNOON' }],
    address: VISIT_ADDRESS,
  };
  const created = await request.post(`${API}/api/v1/service-requests`, { headers: as(customer, true), data });
  expect(created.status(), await created.text()).toBe(201);
  return ((await created.json()) as Created).id;
}

/** The store approves the request. */
export async function approveRequest(
  request: APIRequestContext,
  manager: Account,
  requestId: number,
): Promise<void> {
  const url = `${API}/api/v1/service-requests/${requestId}/approval`;
  await call(request.post(url, { headers: as(manager), data: {} }));
}

/** The manager puts the approved request on the technician's agenda and returns the visit id. */
export async function scheduleVisit(
  request: APIRequestContext,
  manager: Account,
  requestId: number,
  technician: Account,
): Promise<number> {
  const data = { serviceRequestId: requestId, employeeId: technician.id, startsAt: visitStart(requestId) };
  const visit = await call<Created>(
    request.post(`${API}/api/v1/appointments`, { headers: as(manager, true), data }),
  );
  return visit.id;
}

/** The technician finalizes the visit. */
export async function finalizeVisit(
  request: APIRequestContext,
  technician: Account,
  visitId: number,
  repair: string,
): Promise<void> {
  const data = {
    defectFound: true,
    defectDescription: 'Relé de partida queimado.',
    repairDescription: repair,
  };
  const url = `${API}/api/v1/appointments/${visitId}/report`;
  await call(request.post(url, { headers: as(technician, true), data }));
}

/** The manager approves the finalization with the value of the service. */
export async function approveFinalization(
  request: APIRequestContext,
  manager: Account,
  visitId: number,
  amountCents: number,
): Promise<void> {
  const url = `${API}/api/v1/appointments/${visitId}/report/approval`;
  await call(request.post(url, { headers: as(manager, true), data: { amountCents } }));
}

/** A quote request from the customer for a fridge repair. */
export async function requestQuote(
  request: APIRequestContext,
  customer: Account,
  description: string,
): Promise<number> {
  const data = { serviceTypeId: await serviceTypeId(request, FRIDGE_REPAIR), description };
  const quote = await call<Created>(
    request.post(`${API}/api/v1/quotes`, { headers: as(customer, true), data }),
  );
  return quote.id;
}

/** The manager answers the quote with a value valid for a week. */
export async function answerQuote(
  request: APIRequestContext,
  manager: Account,
  quoteId: number,
): Promise<void> {
  const data = {
    amountCents: 35_000,
    validityDays: 7,
    included: 'Troca do relé de partida e teste completo.',
  };
  await call(request.post(`${API}/api/v1/quotes/${quoteId}/answer`, { headers: as(manager, true), data }));
}
