import { describe, expect, it } from 'vitest';
import { PERMISSIONS, can, scopeFor, type Permission } from './permissions.js';
import { ACTORS } from './roles.js';

describe('permission matrix', () => {
  it('gives the catalog to everyone, including guests', () => {
    expect(ACTORS.every((actor) => can(actor, 'catalog.read'))).toBe(true);
  });

  it('restricts destructive actions to the super user (docs/REQUISITOS.md section 5)', () => {
    const adminOnly: Permission[] = [
      'employees.manage',
      'managers.manage',
      'categories.manage',
      'products.delete',
      'serviceTypes.manage',
      'appointments.delete',
      'store.manage',
      'audit.read',
    ];
    for (const permission of adminOnly) {
      expect(ACTORS.filter((actor) => can(actor, permission))).toEqual(['ADMIN']);
    }
  });

  it('lets only the assigned employee complete a service', () => {
    expect(scopeFor('EMPLOYEE', 'appointments.complete')).toBe('own');
    expect(can('MANAGER', 'appointments.complete')).toBe(false);
  });

  it('lets customers see only their own records', () => {
    expect(scopeFor('CLIENT', 'orders.read')).toBe('own');
    expect(scopeFor('MANAGER', 'orders.read')).toBe('all');
  });

  it('denies guests everything except public actions', () => {
    const guestAllowed = (Object.keys(PERMISSIONS) as Permission[]).filter((p) => can('GUEST', p));
    expect(guestAllowed).toEqual(['catalog.read', 'customers.register', 'serviceTypes.read']);
  });
});
