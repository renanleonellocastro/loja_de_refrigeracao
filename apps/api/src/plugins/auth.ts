import fp from 'fastify-plugin';
import { scopeFor, type Actor, type Permission, type Scope } from '@rc/contracts';
import type { FastifyInstance, FastifyRequest, RouteOptions } from 'fastify';
import { verifyAccessToken, type AccessClaims } from '../modules/auth/tokens.js';
import { forbidden, unauthorized } from '../shared/errors.js';
import type { AppContext } from '../context.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth: AccessClaims | null;
    scope: Scope;
  }
  interface FastifyInstance {
    /** Every /api/v1 route with its declared access, used by the permission matrix test. */
    accessCatalog: AccessEntry[];
  }
  interface FastifyContextConfig {
    /** Permission from @rc/contracts required to call the route. */
    permission?: Permission;
    /** Explicitly public route (no permission). Every /api/v1 route must declare one of the two. */
    public?: boolean;
  }
}

export interface AccessEntry {
  method: string;
  url: string;
  permission: Permission | null;
}

export function actorOf(request: FastifyRequest): Actor {
  return request.auth?.role ?? 'GUEST';
}

/** The signed in user, or a 401 when the route was reached without a session. */
export function requireAuth(request: FastifyRequest): AccessClaims {
  if (!request.auth) throw unauthorized();
  return request.auth;
}

export class UndeclaredPermissionError extends Error {
  constructor(route: string) {
    super(`Route ${route} must declare config.permission or config.public`);
    this.name = 'UndeclaredPermissionError';
  }
}

const API_ROUTE_PREFIX = '/api/v1/';
const BEARER_SCHEME = 'Bearer';

type RouteDeclaration = Pick<RouteOptions, 'method' | 'url' | 'config'>;

function isCatalogued(route: RouteDeclaration): boolean {
  return route.url.startsWith(API_ROUTE_PREFIX) && route.method !== 'HEAD';
}

/** Fails fast at startup when an /api/v1 route declares neither a permission nor public access. */
function accessEntryOf(route: RouteDeclaration): AccessEntry {
  const method = String(route.method);
  const config = route.config ?? {};
  if (!config.permission && config.public !== true) {
    throw new UndeclaredPermissionError(`${method} ${route.url}`);
  }
  return { method, url: route.url, permission: config.permission ?? null };
}

function catalogueRoute(app: FastifyInstance, route: RouteDeclaration): void {
  if (isCatalogued(route)) app.accessCatalog.push(accessEntryOf(route));
}

async function claimsOf(ctx: AppContext, header: string): Promise<AccessClaims | null> {
  const [scheme, token] = header.split(' ');
  if (scheme !== BEARER_SCHEME || !token) return null;
  return verifyAccessToken(token, ctx.config.JWT_SECRET, ctx.clock.now());
}

async function authenticate(ctx: AppContext, request: FastifyRequest): Promise<void> {
  const header = request.headers.authorization;
  if (!header) return;
  const claims = await claimsOf(ctx, header);
  if (!claims) throw unauthorized('Sua sessão expirou. Entre novamente.');
  request.auth = claims;
}

async function authorize(request: FastifyRequest): Promise<void> {
  const permission = request.routeOptions.config.permission;
  if (!permission) return;
  const scope = scopeFor(actorOf(request), permission);
  if (scope === 'none') throw request.auth ? forbidden() : unauthorized();
  request.scope = scope;
}

/**
 * Deny by default: routes under /api/v1 must declare a permission or be explicitly public.
 * Bearer tokens are verified on every request; the permission check runs before the handler.
 */
export const authPlugin = fp<{ ctx: AppContext }>(async (app, { ctx }) => {
  app.decorateRequest('auth', null);
  app.decorateRequest('scope', 'none');
  app.decorate('accessCatalog', [] as AccessEntry[]);
  app.addHook('onRoute', (route) => catalogueRoute(app, route));
  app.addHook('onRequest', async (request) => authenticate(ctx, request));
  // Runs before body validation so callers without access never learn the shape of a route.
  app.addHook('preValidation', async (request) => authorize(request));
});
