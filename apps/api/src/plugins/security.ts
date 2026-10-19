import helmet from '@fastify/helmet';
import type { FastifyInstance } from 'fastify';
import type { Config } from '../config.js';

/** The API serves JSON and images: nothing may run, embed or be embedded (docs/SEGURANCA.md, section 4). */
const API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(), payment=(), usb=()';
const DOCS_PREFIX = '/api/docs';
const HSTS_MAX_AGE_SECONDS = 63_072_000;

function helmetOptions(config: Config) {
  return {
    // The reference page under /api/docs loads its own scripts; every other response gets API_CSP below.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    strictTransportSecurity: config.NODE_ENV === 'production' && {
      maxAge: HSTS_MAX_AGE_SECONDS,
      includeSubDomains: true,
    },
  } as const;
}

function addPolicyHeaders(app: FastifyInstance): void {
  app.addHook('onSend', async (request, reply) => {
    reply.header('permissions-policy', PERMISSIONS_POLICY);
    if (!request.url.startsWith(DOCS_PREFIX)) reply.header('content-security-policy', API_CSP);
  });
}

/** Security headers on every response: helmet's defaults plus the API's own policies. */
export async function registerSecurityHeaders(app: FastifyInstance, config: Config): Promise<void> {
  await app.register(helmet, helmetOptions(config));
  addPolicyHeaders(app);
}
