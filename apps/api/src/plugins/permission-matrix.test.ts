import { ROLES, scopeFor } from '@rc/contracts';
import { describe, expect, it } from 'vitest';
import { useTestApp } from '../../test/harness.js';

/**
 * Generated from the routes themselves: every /api/v1 route is called by a guest and by every role,
 * and the answer must match the permission matrix of docs/REQUISITOS.md section 5.
 */
describe('permission matrix over every route', () => {
  const t = useTestApp();

  const concrete = (url: string) => url.replace(/:token/g, 't'.repeat(43)).replace(/:[A-Za-z]+/g, '999999');

  it('covers the routes of every module', () => {
    expect(t.app.accessCatalog.length).toBeGreaterThan(5);
  });

  it('denies and allows exactly as declared', async () => {
    const headersByRole: Record<string, Record<string, string>> = {};
    for (const role of ROLES) headersByRole[role] = (await t.as(role)).headers;

    const mismatches: string[] = [];
    for (const route of t.app.accessCatalog) {
      if (!route.permission) continue;
      const actors = ['GUEST', ...ROLES] as const;
      for (const actor of actors) {
        const response = await t.app.inject({
          method: route.method as 'GET',
          url: concrete(route.url),
          headers: actor === 'GUEST' ? {} : headersByRole[actor],
          payload: route.method === 'GET' || route.method === 'DELETE' ? undefined : {},
        });
        const allowed = scopeFor(actor, route.permission) !== 'none';
        const denied = response.statusCode === 401 || response.statusCode === 403;
        const expected = allowed ? !denied : response.statusCode === (actor === 'GUEST' ? 401 : 403);
        if (!expected) mismatches.push(`${actor} ${route.method} ${route.url} -> ${response.statusCode}`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});
