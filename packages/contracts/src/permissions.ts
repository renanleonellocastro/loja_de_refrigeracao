import type { Actor } from './roles.js';

/**
 * Scope granted to an actor for an action.
 * `all`: any record; `own`: only records owned by the actor; `none`: denied.
 * Staff acting on behalf of a customer is expressed as `all` on the create action.
 */
export type Scope = 'all' | 'own' | 'none';

type Grants = Partial<Record<Actor, Exclude<Scope, 'none'>>>;

const STAFF: Grants = { EMPLOYEE: 'all', MANAGER: 'all', ADMIN: 'all' };
const MANAGEMENT: Grants = { MANAGER: 'all', ADMIN: 'all' };
const ADMIN_ONLY: Grants = { ADMIN: 'all' };
const EVERYONE: Grants = { GUEST: 'all', CLIENT: 'all', EMPLOYEE: 'all', MANAGER: 'all', ADMIN: 'all' };
const SIGNED_IN_OWN: Grants = { CLIENT: 'own', EMPLOYEE: 'own', MANAGER: 'own', ADMIN: 'own' };

/** Permission matrix from docs/REQUISITOS.md section 5. Single source for the API and the web app. */
export const PERMISSIONS = {
  'catalog.read': EVERYONE,
  'customers.register': { GUEST: 'all', MANAGER: 'all', ADMIN: 'all' },
  'customers.read': STAFF,
  /** Staff registration: managers register customers; only the super user registers staff. */
  'users.create': MANAGEMENT,
  /** Edit or delete any account (customers, employees, managers). */
  'users.manage': ADMIN_ONLY,
  'profile.manage': { ...SIGNED_IN_OWN, ADMIN: 'all' },
  'account.delete': { CLIENT: 'own', ADMIN: 'all' },
  'employees.manage': ADMIN_ONLY,
  'employees.read': MANAGEMENT,
  'managers.manage': ADMIN_ONLY,
  'categories.manage': ADMIN_ONLY,
  'products.manage': MANAGEMENT,
  'products.delete': ADMIN_ONLY,
  'cart.manage': SIGNED_IN_OWN,
  'orders.create': { CLIENT: 'own', EMPLOYEE: 'own', MANAGER: 'all', ADMIN: 'all' },
  'orders.read': { CLIENT: 'own', EMPLOYEE: 'own', MANAGER: 'all', ADMIN: 'all' },
  'orders.cancel': { CLIENT: 'own', MANAGER: 'all', ADMIN: 'all' },
  'orders.manage': MANAGEMENT,
  'counterSales.create': STAFF,
  'serviceTypes.read': EVERYONE,
  'serviceTypes.manage': ADMIN_ONLY,
  'serviceRequests.create': { CLIENT: 'own', MANAGER: 'all', ADMIN: 'all' },
  'serviceRequests.read': { CLIENT: 'own', EMPLOYEE: 'own', MANAGER: 'all', ADMIN: 'all' },
  'serviceRequests.cancel': { CLIENT: 'own', MANAGER: 'all', ADMIN: 'all' },
  'serviceRequests.manage': MANAGEMENT,
  'appointments.manage': MANAGEMENT,
  'appointments.delete': ADMIN_ONLY,
  'appointments.read': { EMPLOYEE: 'own', MANAGER: 'all', ADMIN: 'all' },
  'appointments.complete': { EMPLOYEE: 'own' },
  'appointments.approve': MANAGEMENT,
  'quotes.create': { CLIENT: 'own', MANAGER: 'all', ADMIN: 'all' },
  'quotes.read': { CLIENT: 'own', MANAGER: 'all', ADMIN: 'all' },
  'quotes.answer': MANAGEMENT,
  'quotes.decide': { CLIENT: 'own' },
  'dashboard.read': STAFF,
  'notifications.read': SIGNED_IN_OWN,
  'store.manage': ADMIN_ONLY,
  'audit.read': ADMIN_ONLY,
} as const satisfies Record<string, Grants>;

export type Permission = keyof typeof PERMISSIONS;

export function scopeFor(actor: Actor, permission: Permission): Scope {
  const grants: Grants = PERMISSIONS[permission];
  return grants[actor] ?? 'none';
}

export function can(actor: Actor, permission: Permission): boolean {
  return scopeFor(actor, permission) !== 'none';
}
