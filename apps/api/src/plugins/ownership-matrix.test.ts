import { PERMISSIONS, ROLES, scopeFor, type Permission, type Role } from '@rc/contracts';
import { describe, expect, it } from 'vitest';
import {
  appointments,
  notifications,
  orders,
  quotes,
  serviceRequests,
  serviceTypes,
} from '../infra/db/schema.js';
import { jpeg } from '../../test/images.js';
import { multipart } from '../../test/multipart.js';
import { useTestApp } from '../../test/harness.js';
import type { AccessEntry } from './auth.js';

type Headers = Record<string, string>;
type ResourceKind = 'order' | 'serviceRequest' | 'quote' | 'appointment' | 'notification';
interface Session {
  user: { id: number; role: Role };
  headers: Headers;
}

/** Every /api/v1 resource whose access depends on who owns it, by the path of its detail route. */
const OWNED_RESOURCES: Readonly<Record<string, ResourceKind>> = {
  '/api/v1/orders/:id': 'order',
  '/api/v1/service-requests/:id': 'serviceRequest',
  '/api/v1/quotes/:id': 'quote',
  '/api/v1/appointments/:id': 'appointment',
  '/api/v1/me/notifications/:id': 'notification',
};

const ADDRESS = {
  cep: '13800061',
  street: 'Rua Doutor Ulhoa Cintra',
  number: '91',
  complement: null,
  district: 'Centro',
  city: 'Mogi Mirim',
  state: 'SP',
};

// START is 2026-10-05; the visit and the agenda range sit in the following week.
const FIRST_VISIT = Date.parse('2026-10-12T12:00:00.000Z');
const HOUR = 3_600_000;
const AGENDA_RANGE = 'from=2026-10-01&to=2026-10-31';

/** A body every JSON route of an owned resource accepts, so a stranger gets past validation. */
const VALID_BODY = {
  body: 'Mensagem de teste para a loja.',
  reason: 'Motivo de teste.',
  windows: [{ day: '2026-10-19', period: 'MORNING' }],
  defectFound: false,
  repairDescription: 'Troca do capacitor do compressor.',
};

const DENIALS = [401, 403, 404];

/**
 * Routes a role holding `own` still never calls, by a service rule that does not depend on ownership:
 * owner and non owner alike get 403. Technicians see the conversation of their visits, but talking
 * to the customer is done by management.
 */
const ROLE_RULES: Readonly<Record<string, readonly Role[]>> = {
  'POST /api/v1/service-requests/:id/messages': ['EMPLOYEE'],
};

function deniedByRole(label: string, role: Role): boolean {
  return ROLE_RULES[label]?.includes(role) ?? false;
}

function hasOwnScope(permission: Permission): boolean {
  return Object.values(PERMISSIONS[permission]).includes('own');
}

function resourceOf(url: string): ResourceKind | undefined {
  const detail = Object.keys(OWNED_RESOURCES).find((path) => url === path || url.startsWith(`${path}/`));
  return detail ? OWNED_RESOURCES[detail] : undefined;
}

/** Routes addressing one record by id under a permission that some role holds only over its own records. */
function ownedRecordRoutes(catalog: AccessEntry[]) {
  return catalog.filter(
    (route) => route.permission && hasOwnScope(route.permission) && route.url.includes(':id'),
  );
}

/** Collection routes of owned resources: what each caller lists must be limited to what they own. */
function ownedListRoutes(catalog: AccessEntry[]) {
  return catalog.filter(
    (route) =>
      route.method === 'GET' &&
      route.permission !== null &&
      hasOwnScope(route.permission) &&
      OWNED_RESOURCES[`${route.url}/:id`] !== undefined,
  );
}

/**
 * Generated from the routes themselves: every route that reads or changes a record whose access
 * depends on ownership is called by its owner and by a non owner of each role, and the answer must
 * match the scope of the permission matrix (docs/REQUISITOS.md section 5). A non owner gets 404 so
 * the record's existence never leaks.
 */
describe('ownership matrix over every owned resource route', () => {
  const t = useTestApp();

  async function sessionsByRole(): Promise<Record<Role, Session>> {
    const sessions = {} as Record<Role, Session>;
    for (const role of ROLES) sessions[role] = await t.as(role);
    return sessions;
  }

  async function serviceType() {
    const [row] = await t.db
      .insert(serviceTypes)
      .values({ name: `Serviço ${Math.random()}`, estimatedMinutes: 120 })
      .returning();
    return row!;
  }

  async function quoteFor(customerId: number) {
    const type = await serviceType();
    const [row] = await t.db
      .insert(quotes)
      .values({
        customerId,
        serviceTypeId: type.id,
        description: 'Instalação de ar.',
        createdById: customerId,
      })
      .returning();
    return row!.id;
  }

  async function requestFor(customerId: number, status: 'REQUESTED' | 'SCHEDULED' = 'REQUESTED') {
    const type = await serviceType();
    const [row] = await t.db
      .insert(serviceRequests)
      .values({
        customerId,
        serviceTypeId: type.id,
        productKind: 'Geladeira',
        problem: 'Não gela.',
        address: ADDRESS,
        status,
        createdById: customerId,
      })
      .returning();
    return row!.id;
  }

  let visits = 0;

  /** Each visit gets its own hour so a technician's appointments never overlap. */
  function nextVisit() {
    visits += 1;
    const startsAt = FIRST_VISIT + visits * HOUR;
    return { startsAt: new Date(startsAt), endsAt: new Date(startsAt + HOUR) };
  }

  async function appointmentFor(employeeId: number, customerId: number) {
    const serviceRequestId = await requestFor(customerId, 'SCHEDULED');
    const [row] = await t.db
      .insert(appointments)
      .values({ serviceRequestId, employeeId, ...nextVisit(), createdById: employeeId })
      .returning();
    return { appointmentId: row!.id, serviceRequestId };
  }

  async function orderFor(customerId: number) {
    const [row] = await t.db
      .insert(orders)
      .values({
        customerId,
        channel: 'ONLINE',
        status: 'PENDING_REVIEW',
        totalCents: 0,
        createdById: customerId,
      })
      .returning();
    return row!.id;
  }

  async function notificationFor(userId: number) {
    const [row] = await t.db
      .insert(notifications)
      .values({ userId, type: 'TEST', title: 'Aviso', body: 'Aviso de teste.' })
      .returning();
    return row!.id;
  }

  /** A fresh record owned by the user: the customer of it, or the technician assigned to it. */
  async function ownedBy(kind: ResourceKind, owner: Session, customer: Session): Promise<number> {
    const technician = owner.user.role === 'EMPLOYEE';
    if (kind === 'order') return orderFor(owner.user.id);
    if (kind === 'quote') return quoteFor(owner.user.id);
    if (kind === 'notification') return notificationFor(owner.user.id);
    if (kind === 'appointment') return (await appointmentFor(owner.user.id, customer.user.id)).appointmentId;
    if (!technician) return requestFor(owner.user.id);
    return (await appointmentFor(owner.user.id, customer.user.id)).serviceRequestId;
  }

  /** The owner of a record of the route when the caller can reach any record: the first role scoped to its own. */
  function defaultOwnerRole(permission: Permission): Role {
    return ROLES.find((role) => scopeFor(role, permission) === 'own')!;
  }

  async function call(route: AccessEntry, id: number, headers: Headers) {
    const url = route.url.replace(':id', String(id));
    if (url.endsWith('/photos')) {
      const form = multipart([
        { name: 'foto', value: await jpeg(64, 48), filename: 'foto.jpg', contentType: 'image/jpeg' },
      ]);
      return t.app.inject({
        method: 'POST',
        url,
        headers: { ...headers, ...form.headers },
        payload: form.payload,
      });
    }
    const payload = route.method === 'GET' || route.method === 'DELETE' ? undefined : VALID_BODY;
    return t.app.inject({ method: route.method as 'GET', url, headers, payload });
  }

  async function listIds(route: AccessEntry, headers: Headers, probe: string): Promise<number[]> {
    const range = route.url.endsWith('/appointments') ? `&${AGENDA_RANGE}` : '';
    const response = await t.app.inject({ method: 'GET', url: `${route.url}?${probe}${range}`, headers });
    expect(response.statusCode, `${route.url} -> ${response.body}`).toBe(200);
    const body = response.json<{ id: number }[] | { data: { id: number }[] }>();
    return (Array.isArray(body) ? body : body.data).map((item) => item.id);
  }

  it('knows the owned resource of every route scoped to the caller own records', () => {
    const routes = ownedRecordRoutes(t.app.accessCatalog);
    expect(routes.length).toBeGreaterThan(15);
    expect(routes.filter((route) => !resourceOf(route.url)).map((route) => route.url)).toEqual([]);
    expect(
      ownedListRoutes(t.app.accessCatalog)
        .map((route) => route.url)
        .sort(),
    ).toEqual(
      Object.keys(OWNED_RESOURCES)
        .map((path) => path.replace('/:id', ''))
        .sort(),
    );
  });

  it('lets the owner reach the record and hides it from every non owner', async () => {
    const owners = await sessionsByRole();
    const strangers = await sessionsByRole();
    const customer = await t.as('CLIENT');

    const mismatches: string[] = [];
    for (const route of ownedRecordRoutes(t.app.accessCatalog)) {
      const permission = route.permission!;
      const kind = resourceOf(route.url)!;
      const label = `${route.method} ${route.url}`;
      for (const role of ROLES) {
        const scope = scopeFor(role, permission);
        if (scope === 'own' && deniedByRole(label, role)) {
          const id = await ownedBy(kind, owners[role], customer);
          for (const session of [strangers[role], owners[role]]) {
            const response = await call(route, id, session.headers);
            if (response.statusCode !== 403)
              mismatches.push(`${role} by role ${label} -> ${response.statusCode}`);
          }
        } else if (scope === 'own') {
          const id = await ownedBy(kind, owners[role], customer);
          const asStranger = await call(route, id, strangers[role].headers);
          if (asStranger.statusCode !== 404)
            mismatches.push(`${role} non owner ${label} -> ${asStranger.statusCode}`);
          const asOwner = await call(route, id, owners[role].headers);
          if (DENIALS.includes(asOwner.statusCode))
            mismatches.push(`${role} owner ${label} -> ${asOwner.statusCode}`);
        } else if (scope === 'all') {
          const id = await ownedBy(kind, owners[defaultOwnerRole(permission)], customer);
          const response = await call(route, id, strangers[role].headers);
          if (DENIALS.includes(response.statusCode))
            mismatches.push(`${role} any ${label} -> ${response.statusCode}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('lists to each caller only the records they own unless they may see all', async () => {
    const owners = await sessionsByRole();
    const strangers = await sessionsByRole();
    const customer = await t.as('CLIENT');

    const mismatches: string[] = [];
    for (const route of ownedListRoutes(t.app.accessCatalog)) {
      const permission = route.permission!;
      const kind = OWNED_RESOURCES[`${route.url}/:id`]!;
      for (const role of ROLES) {
        const scope = scopeFor(role, permission);
        if (scope === 'none') continue;
        const owner = owners[scope === 'own' ? role : defaultOwnerRole(permission)];
        const id = await ownedBy(kind, owner, customer);
        // Asking for the owner's records by filter must not widen what a caller scoped to its own sees.
        const probe = `customerId=${owner.user.id}&employeeId=${owner.user.id}`;
        const seenByStranger = (await listIds(route, strangers[role].headers, probe)).includes(id);
        if (seenByStranger !== (scope === 'all'))
          mismatches.push(`${role} non owner GET ${route.url} sees=${seenByStranger}`);
        if (scope === 'own' && !(await listIds(route, owners[role].headers, '')).includes(id))
          mismatches.push(`${role} owner GET ${route.url} misses its record`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});
